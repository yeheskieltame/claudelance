import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import { activities, goalLinks, goals } from '../db/schema.js';
import { requireRole } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { badRequest, notFound, parse } from '../lib/errors.js';
import { loadGoalScoped, loadProjectScoped, loadTaskScoped } from '../lib/loaders.js';
import { serializeGoal, serializeGoalLink } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeGoalProgress } from '../services/goals.js';

/** Goals / OKRs with progress auto-rolled-up from linked tasks and projects. */
export function goalRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  const createSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    targetValue: z.number().optional(),
    unit: z.string().max(40).optional(),
    dueDate: z.string().datetime().optional(),
  });

  r.post('/goals', async (c) => {
    const { workspace, member } = c.get('auth');
    requireRole(c, 'member');
    const body = parse(createSchema, await c.req.json().catch(() => ({})));
    const goal = (
      await db
        .insert(goals)
        .values({
          workspaceId: workspace.id,
          name: body.name,
          description: body.description ?? null,
          targetValue: body.targetValue ?? null,
          unit: body.unit ?? null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
        })
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      actorMemberId: member.id,
      verb: 'goal.created',
      payload: { goalId: goal.id, name: goal.name },
    });
    return c.json(serializeGoal(goal, await computeGoalProgress(db, goal.id)), 201);
  });

  r.get('/goals', async (c) => {
    const { workspace } = c.get('auth');
    const rows = await db.select().from(goals).where(eq(goals.workspaceId, workspace.id));
    const items = await Promise.all(
      rows.map(async (g) => serializeGoal(g, await computeGoalProgress(db, g.id))),
    );
    return c.json({ items });
  });

  r.get('/goals/:id', async (c) => {
    const { workspace } = c.get('auth');
    const goal = await loadGoalScoped(db, c.req.param('id'), workspace.id);
    const links = await db.select().from(goalLinks).where(eq(goalLinks.goalId, goal.id));
    return c.json({
      ...serializeGoal(goal, await computeGoalProgress(db, goal.id)),
      links: links.map(serializeGoalLink),
    });
  });

  const patchSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    targetValue: z.number().nullable().optional(),
    currentValue: z.number().optional(),
    unit: z.string().max(40).nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    status: z.enum(['on_track', 'at_risk', 'off_track', 'done']).optional(),
  });

  r.patch('/goals/:id', async (c) => {
    const { workspace, member } = c.get('auth');
    requireRole(c, 'member');
    const goal = await loadGoalScoped(db, c.req.param('id'), workspace.id);
    const body = parse(patchSchema, await c.req.json().catch(() => ({})));
    const updated = (
      await db
        .update(goals)
        .set({
          updatedAt: new Date(),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.targetValue !== undefined ? { targetValue: body.targetValue } : {}),
          ...(body.currentValue !== undefined ? { currentValue: body.currentValue } : {}),
          ...(body.unit !== undefined ? { unit: body.unit } : {}),
          ...(body.dueDate !== undefined
            ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        })
        .where(eq(goals.id, goal.id))
        .returning()
    )[0]!;
    if (body.currentValue !== undefined) {
      await db.insert(activities).values({
        workspaceId: workspace.id,
        actorMemberId: member.id,
        verb: 'goal.progressed',
        payload: { goalId: goal.id, currentValue: body.currentValue },
      });
    }
    return c.json(serializeGoal(updated, await computeGoalProgress(db, updated.id)));
  });

  const linkSchema = z.object({
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    weight: z.number().positive().optional(),
  });

  r.post('/goals/:id/links', async (c) => {
    const { workspace } = c.get('auth');
    requireRole(c, 'member');
    const goal = await loadGoalScoped(db, c.req.param('id'), workspace.id);
    const body = parse(linkSchema, await c.req.json().catch(() => ({})));
    if (!body.projectId && !body.taskId) throw badRequest('link requires projectId or taskId');
    if (body.projectId) await loadProjectScoped(db, body.projectId, workspace.id);
    if (body.taskId) await loadTaskScoped(db, body.taskId, workspace.id);
    const link = (
      await db
        .insert(goalLinks)
        .values({
          goalId: goal.id,
          projectId: body.projectId ?? null,
          taskId: body.taskId ?? null,
          weight: body.weight ?? 1,
        })
        .returning()
    )[0]!;
    return c.json(serializeGoalLink(link), 201);
  });

  r.delete('/goals/:id/links/:linkId', async (c) => {
    const { workspace } = c.get('auth');
    requireRole(c, 'member');
    const goal = await loadGoalScoped(db, c.req.param('id'), workspace.id);
    const deleted = await db
      .delete(goalLinks)
      .where(and(eq(goalLinks.id, c.req.param('linkId')), eq(goalLinks.goalId, goal.id)))
      .returning();
    if (deleted.length === 0) throw notFound('goal link not found');
    return c.json({ ok: true });
  });

  return r;
}
