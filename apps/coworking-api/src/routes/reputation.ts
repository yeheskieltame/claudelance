import { and, asc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import { members, projects, reputationBridge, taskReviews, tasks } from '../db/schema.js';
import { requireScope } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { parse } from '../lib/errors.js';
import { serializePendingReputationItem } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * ERC-8004 reputation write-back bridge - the OFF-CHAIN half. This router never
 * touches the chain: it only surfaces approved task reviews owed an on-chain
 * positive feedback signal (pending feed) and records that the off-chain relayer
 * has handled one (ack). The relayer is the sole component that signs and sends
 * the giveFeedback transaction; it polls /reputation/pending and acks back here.
 *
 * Idempotency unit: a single task review (taskReviews.id). A review leaves the
 * pending feed forever once a reputation_bridge row exists for it, so the relayer
 * attests each approval exactly once even across retries / overlapping polls.
 *
 * Auth: both routes require an admin-scoped API key (the relayer uses the
 * operator's admin key). This is the existing 'admin' scope, not a new one.
 */
export function reputationRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  // GET /reputation/pending - approved reviews whose assignee is an agent with a
  // linked agentId and which have NOT yet been acked. Cursor-paginated by review
  // createdAt (ASC) so the relayer can drain the backlog incrementally.
  r.get('/reputation/pending', async (c) => {
    requireScope(c, 'admin');
    const { workspace } = c.get('auth');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 100) || 100, 1), 200);
    const sinceRaw = c.req.query('since');
    // Cursor is a review-createdAt timestamp; default to the epoch (everything).
    const since = sinceRaw ? new Date(sinceRaw) : new Date(0);

    const rows = await db
      .select({
        reviewId: taskReviews.id,
        taskId: tasks.id,
        taskNumber: tasks.number,
        taskType: tasks.type,
        projectId: projects.id,
        linkedBountyId: projects.linkedBountyId,
        agentId: members.agentId,
        assigneeMemberId: members.id,
        reviewedAt: taskReviews.createdAt,
        score: taskReviews.score,
      })
      .from(taskReviews)
      .innerJoin(tasks, eq(taskReviews.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      // The reputation subject is the task's ASSIGNEE (who did the work), not the
      // reviewer who recorded the verdict.
      .innerJoin(members, eq(tasks.assigneeMemberId, members.id))
      // Anti-join: exclude anything already acked into the ledger.
      .leftJoin(reputationBridge, eq(reputationBridge.reviewId, taskReviews.id))
      .where(
        and(
          eq(taskReviews.verdict, 'approved'),
          eq(members.workspaceId, workspace.id),
          eq(members.kind, 'agent'),
          isNotNull(members.agentId),
          isNull(tasks.trashedAt),
          gt(taskReviews.createdAt, since),
          isNull(reputationBridge.reviewId),
        ),
      )
      .orderBy(asc(taskReviews.createdAt), asc(taskReviews.id))
      .limit(limit);

    const items = rows.map((row) =>
      // agentId is non-null here (filtered by isNotNull above); assert for the type.
      serializePendingReputationItem({ ...row, agentId: row.agentId! }),
    );
    const nextCursor = items.length > 0 ? items[items.length - 1]!.reviewedAt : null;
    return c.json({ items, nextCursor });
  });

  const ackSchema = z.object({
    reviewId: z.string().min(1),
    txHash: z.string().min(1).max(200).optional(),
    agentId: z.string().regex(/^\d+$/),
  });

  // POST /reputation/ack - the relayer records that it has handled a review
  // (on-chain or, in dry-run, intentionally not). Upsert on the reviewId PK so a
  // retried ack is a no-op rather than an error - the bridge is idempotent.
  r.post('/reputation/ack', async (c) => {
    requireScope(c, 'admin');
    const { workspace } = c.get('auth');
    const body = parse(ackSchema, await c.req.json().catch(() => ({})));

    await db
      .insert(reputationBridge)
      .values({
        reviewId: body.reviewId,
        workspaceId: workspace.id,
        agentId: BigInt(body.agentId),
        txHash: body.txHash ?? null,
        attestedAt: new Date(),
      })
      // Idempotent: an already-acked review keeps its first attestation, but a
      // later ack that carries the tx hash (e.g. dry-run -> live) fills it in.
      .onConflictDoUpdate({
        target: reputationBridge.reviewId,
        set: { txHash: body.txHash ?? null, attestedAt: new Date() },
      });

    return c.json({ ok: true, reviewId: body.reviewId });
  });

  return r;
}
