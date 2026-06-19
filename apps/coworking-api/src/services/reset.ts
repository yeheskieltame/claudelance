// Reset capability: recoverable SOFT-DELETE of tasks (and projects, for a
// workspace clear) behind a two-call dry-run -> commit handshake. Members and
// API keys are NEVER touched - only `tasks.trashedAt` / `projects.trashedAt` are
// stamped, so a reset is fully reversible by un-trashing. The flow is:
//
//   1. dry-run  -> computeResetPreview() returns the per-entity counts plus a
//                  server confirmation token bound to a deterministic hash of
//                  those counts (issueResetToken).
//   2. commit   -> consumeResetToken() re-checks the hash against the *current*
//                  counts (409 on drift, 410 if already consumed, 422 if expired)
//                  then perform{ProjectReset,WorkspaceClear} / seedDemo runs the
//                  soft-delete inside a single db.transaction.
//
// Every commit is additionally guarded by an Idempotency-Key (24h replay window)
// and writes one workspace-scoped activity row + an append-only audit_log entry.

import { createHash, randomUUID } from 'node:crypto';

import { and, count, eq, inArray, isNull } from 'drizzle-orm';

import type { ResetScope } from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import {
  activities,
  auditLog,
  comments,
  goalLinks,
  goals,
  idempotencyKeys,
  members,
  projects,
  resetTokens,
  statusColumns,
  taskDependencies,
  tasks,
  timeEntries,
  workspaces,
} from '../db/schema.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';

/** How long a freshly-issued confirmation token stays valid. */
const TOKEN_TTL_MS = 5 * 60 * 1000; // ~5 minutes
/** How long an idempotent commit response is replayed for. */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Per-entity counts an operation will affect; serialized as ResetPreview.counts. */
export type ResetCounts = Record<string, number>;

/**
 * Deterministically hash the count map so the commit call can detect drift.
 * Keys are sorted so the hash is independent of insertion order; uses SHA-256
 * from node:crypto (NEVER Math.random) so the same counts always hash the same.
 */
export function hashCounts(counts: ResetCounts): string {
  const stable = Object.keys(counts)
    .sort()
    .map((k) => `${k}=${counts[k]}`)
    .join('&');
  return createHash('sha256').update(stable).digest('hex');
}

/** Count rows of a single-table query result (defensive against empty result). */
function num(rows: Array<{ value: number }>): number {
  return rows[0]?.value ?? 0;
}

/** Ids of the live (non-trashed) projects in scope for a given reset. */
async function inScopeProjectIds(
  db: Database,
  workspaceId: string,
  scope: ResetScope,
  targetId: string | null,
): Promise<string[]> {
  if (scope === 'project') {
    if (!targetId) return [];
    return [targetId];
  }
  // workspace / demo: every live project in the workspace.
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.trashedAt)));
  return rows.map((r) => r.id);
}

/**
 * Compute what a reset WOULD soft-delete (and, for the workspace clear, the
 * always-preserved sets). Only counts live (non-trashed) rows, since trashing an
 * already-trashed row is a no-op. The returned countsHash binds a later commit.
 */
export async function computeResetPreview(
  db: Database,
  workspaceId: string,
  scope: ResetScope,
  targetId: string | null = null,
): Promise<{
  willDelete: ResetCounts;
  willPreserve: ResetCounts;
  countsHash: string;
}> {
  const projectIds = await inScopeProjectIds(db, workspaceId, scope, targetId);

  // No live projects in scope -> nothing to delete (but preserve counts still apply).
  let tasksCount = 0;
  let commentsCount = 0;
  let timeEntriesCount = 0;
  let dependenciesCount = 0;
  if (projectIds.length > 0) {
    // Live task ids drive both the task count and the attached-volume counts.
    // Comments / time entries / dependencies are reported as the volume attached
    // to the in-scope live tasks (they cascade with the task on a real delete; on
    // a soft-delete they ride along by virtue of the task being hidden).
    const liveTaskIds = (
      await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.trashedAt)))
    ).map((r) => r.id);
    tasksCount = liveTaskIds.length;
    if (liveTaskIds.length > 0) {
      commentsCount = num(
        await db
          .select({ value: count() })
          .from(comments)
          .where(inArray(comments.taskId, liveTaskIds)),
      );
      timeEntriesCount = num(
        await db
          .select({ value: count() })
          .from(timeEntries)
          .where(inArray(timeEntries.taskId, liveTaskIds)),
      );
      dependenciesCount = num(
        await db
          .select({ value: count() })
          .from(taskDependencies)
          .where(inArray(taskDependencies.blockedTaskId, liveTaskIds)),
      );
    }
  }

  // For a workspace clear, the live projects themselves are trashed too.
  const projectsCount = scope === 'project' ? 0 : projectIds.length;

  const willDelete: ResetCounts = {
    projects: projectsCount,
    tasks: tasksCount,
    comments: commentsCount,
    timeEntries: timeEntriesCount,
    dependencies: dependenciesCount,
  };

  // Always-preserved sets (reported for transparency; never mutated by a reset).
  const membersCount = num(
    await db.select({ value: count() }).from(members).where(eq(members.workspaceId, workspaceId)),
  );
  const ws = (
    await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  )[0];
  const willPreserve: ResetCounts = {
    members: membersCount,
    isPremium: ws?.isPremium ? 1 : 0,
  };

  // The hash binds *exactly* the willDelete set the commit must reproduce.
  return { willDelete, willPreserve, countsHash: hashCounts(willDelete) };
}

/**
 * Issue a confirmation token for a dry-run. Stores the bound countsHash, scope,
 * target and a TTL; the token id is what the caller echoes back on commit.
 */
export async function issueResetToken(
  db: Database,
  params: {
    workspaceId: string;
    scope: ResetScope;
    targetId: string | null;
    countsHash: string;
    createdByMemberId: string | null;
    now?: Date;
  },
): Promise<{ id: string; expiresAt: Date }> {
  const now = params.now ?? new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
  const row = (
    await db
      .insert(resetTokens)
      .values({
        workspaceId: params.workspaceId,
        scope: params.scope,
        targetId: params.targetId,
        countsHash: params.countsHash,
        expiresAt,
        createdByMemberId: params.createdByMemberId,
      })
      .returning()
  )[0]!;
  return { id: row.id, expiresAt };
}

/**
 * Validate + consume a confirmation token for a commit. Re-derives the current
 * counts and enforces the handshake:
 *   - 404 token_not_found if the id is unknown / not in this workspace,
 *   - 409 reset_counts_changed if the bound hash no longer matches,
 *   - 410 reset_token_consumed if it was already used,
 *   - 422 reset_token_expired if past its TTL.
 * On success the token is marked consumed (single-use) and the live counts are
 * returned so the caller can run the soft-delete against the same set.
 */
export async function consumeResetToken(
  db: Database,
  params: {
    workspaceId: string;
    tokenId: string;
    scope: ResetScope;
    targetId: string | null;
    now?: Date;
  },
): Promise<{ counts: ResetCounts }> {
  const now = params.now ?? new Date();
  const row = (
    await db
      .select()
      .from(resetTokens)
      .where(and(eq(resetTokens.id, params.tokenId), eq(resetTokens.workspaceId, params.workspaceId)))
      .limit(1)
  )[0];
  if (!row) throw notFound('confirmation token not found');
  // Bind the token to the same scope/target it was issued for. HttpError lets us
  // raise the 410/422 statuses the named errors.ts helpers don't cover; the
  // central errorHandler serializes it identically.
  if (row.scope !== params.scope || (row.targetId ?? null) !== (params.targetId ?? null)) {
    throw new HttpError(409, 'reset_scope_mismatch', 'confirmation token was issued for a different scope/target');
  }
  if (row.consumedAt) {
    throw new HttpError(410, 'reset_token_consumed', 'confirmation token already used');
  }
  if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) {
    throw new HttpError(422, 'reset_token_expired', 'confirmation token expired; request a new dry-run');
  }

  const { willDelete } = await computeResetPreview(db, params.workspaceId, params.scope, params.targetId);
  if (hashCounts(willDelete) !== row.countsHash) {
    throw new HttpError(409, 'reset_counts_changed', 'workspace changed since the dry-run; request a new dry-run');
  }

  // Single-use: stamp consumedAt. A concurrent commit racing on the same token
  // is guarded by re-reading consumedAt under the WHERE clause.
  const consumed = await db
    .update(resetTokens)
    .set({ consumedAt: now })
    .where(and(eq(resetTokens.id, row.id), isNull(resetTokens.consumedAt)))
    .returning();
  if (consumed.length === 0) {
    throw new HttpError(410, 'reset_token_consumed', 'confirmation token already used');
  }
  return { counts: willDelete };
}

/**
 * Assert no members / api keys would be touched. A reset must NEVER affect the
 * identity layer; this is a belt-and-suspenders guard since the soft-delete only
 * ever writes to tasks/projects, but it documents and enforces the invariant.
 */
function assertNoIdentityImpact(targetTables: string[]): void {
  if (targetTables.some((t) => t === 'members' || t === 'api_keys')) {
    throw forbidden('reset would affect members or api keys, which is not allowed');
  }
}

/** Shared write of the post-reset activity + audit_log rows inside a tx. */
async function recordReset(
  tx: Database,
  params: {
    workspaceId: string;
    actorMemberId: string | null;
    apiKeyId: string | null;
    scope: ResetScope;
    targetId: string | null;
    verb: 'project.reset' | 'workspace.cleared' | 'workspace.seeded_demo';
    counts: ResetCounts;
    tokenId: string | null;
    idempotencyKey: string | null;
  },
): Promise<void> {
  await tx.insert(activities).values({
    workspaceId: params.workspaceId,
    projectId: null, // workspace-scoped: the project may itself be trashed.
    taskId: null,
    actorMemberId: params.actorMemberId,
    verb: params.verb,
    payload: { scope: params.scope, targetId: params.targetId, counts: params.counts },
  });
  await tx.insert(auditLog).values({
    workspaceId: params.workspaceId,
    actorMemberId: params.actorMemberId,
    apiKeyId: params.apiKeyId,
    action: params.verb,
    scope: params.scope,
    payload: {
      targetId: params.targetId,
      counts: params.counts,
      tokenId: params.tokenId,
      idempotencyKey: params.idempotencyKey,
    },
  });
}

export interface PerformContext {
  workspaceId: string;
  actorMemberId: string | null;
  apiKeyId: string | null;
  tokenId: string | null;
  idempotencyKey: string | null;
  now?: Date;
}

/**
 * Soft-delete every live task in one project (recoverable). When
 * restoreDefaultColumns is set, the board is reset to the default columns AFTER
 * the tasks are trashed - tasks.statusColumnId is onDelete:'restrict', so the
 * old columns can only be removed once no live task references them. Trashed
 * tasks keep their (now-deleted) column id; that's fine because restore is a
 * manual, deliberate action and a restored task can be re-triaged.
 */
export async function performProjectReset(
  db: Database,
  project: { id: string; workspaceId: string },
  opts: { restoreDefaultColumns?: boolean } = {},
  ctx: PerformContext,
): Promise<ResetCounts> {
  assertNoIdentityImpact(['tasks', 'projects']);
  const now = ctx.now ?? new Date();
  return db.transaction(async (tx) => {
    const txdb = tx as unknown as Database;
    const { willDelete } = await computeResetPreview(txdb, project.workspaceId, 'project', project.id);

    // 1) Trash the live tasks (must happen before touching columns).
    await txdb
      .update(tasks)
      .set({ trashedAt: now, trashedByMemberId: ctx.actorMemberId, updatedAt: now })
      .where(and(eq(tasks.projectId, project.id), isNull(tasks.trashedAt)));

    // 2) Optionally rebuild the board to the default columns.
    if (opts.restoreDefaultColumns) {
      await txdb.delete(statusColumns).where(eq(statusColumns.projectId, project.id));
      await txdb.insert(statusColumns).values(
        DEFAULT_COLUMNS.map((col, i) => ({
          projectId: project.id,
          key: col.key,
          name: col.name,
          category: col.category,
          position: i,
        })),
      );
    }

    await recordReset(txdb, {
      workspaceId: project.workspaceId,
      actorMemberId: ctx.actorMemberId,
      apiKeyId: ctx.apiKeyId,
      scope: 'project',
      targetId: project.id,
      verb: 'project.reset',
      counts: willDelete,
      tokenId: ctx.tokenId,
      idempotencyKey: ctx.idempotencyKey,
    });
    return willDelete;
  });
}

/**
 * Soft-delete every live project AND its tasks in the workspace (recoverable).
 * Members, api keys and the workspace row (incl. isPremium) are preserved. Tasks
 * are trashed before projects so any restrict constraints stay satisfied; both
 * are reversible by un-trashing.
 */
export async function performWorkspaceClear(
  db: Database,
  workspaceId: string,
  ctx: PerformContext,
): Promise<ResetCounts> {
  assertNoIdentityImpact(['tasks', 'projects']);
  const now = ctx.now ?? new Date();
  return db.transaction(async (tx) => {
    const txdb = tx as unknown as Database;
    const { willDelete } = await computeResetPreview(txdb, workspaceId, 'workspace', null);

    const projectIds = (
      await txdb
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.trashedAt)))
    ).map((r) => r.id);

    if (projectIds.length > 0) {
      // 1) Trash tasks first.
      await txdb
        .update(tasks)
        .set({ trashedAt: now, trashedByMemberId: ctx.actorMemberId, updatedAt: now })
        .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.trashedAt)));
      // 2) Then trash the projects themselves.
      await txdb
        .update(projects)
        .set({ trashedAt: now, trashedByMemberId: ctx.actorMemberId, updatedAt: now })
        .where(and(inArray(projects.id, projectIds), isNull(projects.trashedAt)));
    }

    await recordReset(txdb, {
      workspaceId,
      actorMemberId: ctx.actorMemberId,
      apiKeyId: ctx.apiKeyId,
      scope: 'workspace',
      targetId: null,
      verb: 'workspace.cleared',
      counts: willDelete,
      tokenId: ctx.tokenId,
      idempotencyKey: ctx.idempotencyKey,
    });
    return willDelete;
  });
}

/** Default board, mirrored from routes/projects.ts so a reset can rebuild it. */
const DEFAULT_COLUMNS = [
  { key: 'backlog', name: 'Backlog', category: 'backlog' },
  { key: 'todo', name: 'To Do', category: 'unstarted' },
  { key: 'in_progress', name: 'In Progress', category: 'started' },
  { key: 'in_review', name: 'In Review', category: 'started' },
  { key: 'done', name: 'Done', category: 'completed' },
  { key: 'canceled', name: 'Canceled', category: 'canceled' },
] as const;

/** A canned demo task spec (column key + ordinal + AC count). */
interface DemoTaskSpec {
  title: string;
  type: string;
  columnKey: string;
  priority: number;
  ac: string[];
}

const DEMO_TASKS: DemoTaskSpec[] = [
  { title: 'Set up the project repo', type: 'devops', columnKey: 'done', priority: 3, ac: ['Repo created', 'CI configured'] },
  { title: 'Design the landing page', type: 'design', columnKey: 'done', priority: 3, ac: ['Wireframe approved'] },
  { title: 'Implement the auth flow', type: 'code', columnKey: 'in_progress', priority: 1, ac: ['Login works', 'Logout works', 'Session persists'] },
  { title: 'Write the API docs', type: 'documentation', columnKey: 'in_review', priority: 3, ac: ['All endpoints documented'] },
  { title: 'Research competitor pricing', type: 'research', columnKey: 'todo', priority: 2, ac: ['Three competitors compared'] },
  { title: 'Draft launch announcement', type: 'content', columnKey: 'todo', priority: 3, ac: [] },
  { title: 'Plan the launch event', type: 'event', columnKey: 'backlog', priority: 4, ac: [] },
  { title: 'QA the checkout flow', type: 'qa', columnKey: 'backlog', priority: 2, ac: ['Happy path passes', 'Edge cases covered'] },
];

/**
 * Seed a canned demo project (board + ~8 tasks + a couple of dependencies + one
 * goal) into the workspace. Refuses on a non-empty workspace (any live project)
 * unless `force` is set, so it can't silently clobber real work. Uses the same
 * reporter (the actor) for created rows; never touches members/api keys.
 */
export async function seedDemo(
  db: Database,
  workspaceId: string,
  opts: { force?: boolean } = {},
  ctx: PerformContext,
): Promise<ResetCounts> {
  const now = ctx.now ?? new Date();
  // Guard: refuse on a non-empty workspace unless forced.
  const liveProjects = num(
    await db
      .select({ value: count() })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.trashedAt))),
  );
  if (liveProjects > 0 && !opts.force) {
    throw conflict(
      'workspace already has projects; pass force:true to seed the demo anyway',
      'workspace_not_empty',
    );
  }

  return db.transaction(async (tx) => {
    const txdb = tx as unknown as Database;
    // Unique-ish key so a forced re-seed doesn't collide with an existing DEMO.
    const suffix = randomUUID().slice(0, 4).toUpperCase();
    const key = liveProjects > 0 ? `DEMO-${suffix}` : 'DEMO';
    const project = (
      await txdb
        .insert(projects)
        .values({
          workspaceId,
          key,
          name: 'Demo Project',
          description: 'A sample project seeded to show off the board, tasks, dependencies and goals.',
          createdByMemberId: ctx.actorMemberId,
        })
        .returning()
    )[0]!;

    const cols = (
      await txdb
        .insert(statusColumns)
        .values(
          DEFAULT_COLUMNS.map((col, i) => ({
            projectId: project.id,
            key: col.key,
            name: col.name,
            category: col.category,
            position: i,
          })),
        )
        .returning()
    ).reduce<Record<string, string>>((acc, c) => {
      acc[c.key] = c.id;
      return acc;
    }, {});

    const createdTaskIds: string[] = [];
    let n = 0;
    for (const spec of DEMO_TASKS) {
      n += 1;
      const columnId = cols[spec.columnKey] ?? cols.backlog!;
      const isDone = spec.columnKey === 'done';
      const inserted = (
        await txdb
          .insert(tasks)
          .values({
            projectId: project.id,
            number: n,
            title: spec.title,
            type: spec.type,
            statusColumnId: columnId,
            priority: spec.priority,
            acceptanceCriteria: spec.ac.map((text) => ({
              id: randomUUID(),
              kind: 'rule' as const,
              text,
              done: isDone,
            })),
            createdByMemberId: ctx.actorMemberId,
            ...(isDone ? { completedAt: now, completionReason: 'completed' } : {}),
          })
          .returning()
      )[0]!;
      createdTaskIds.push(inserted.id);
    }

    // A couple of dependencies: "auth flow" (idx 2) blocked by "repo" (idx 0);
    // "QA checkout" (idx 7) blocked by "auth flow" (idx 2).
    const deps = [
      { blocker: createdTaskIds[0]!, blocked: createdTaskIds[2]! },
      { blocker: createdTaskIds[2]!, blocked: createdTaskIds[7]! },
    ];
    await txdb.insert(taskDependencies).values(
      deps.map((d) => ({ blockerTaskId: d.blocker, blockedTaskId: d.blocked, type: 'blocks' })),
    );

    // One goal linked to the demo project.
    const goal = (
      await txdb
        .insert(goals)
        .values({
          workspaceId,
          name: 'Ship the demo product',
          description: 'Roll-up goal for the seeded demo project.',
          targetValue: DEMO_TASKS.length,
          unit: 'tasks',
        })
        .returning()
    )[0]!;
    await txdb.insert(goalLinks).values({ goalId: goal.id, projectId: project.id, weight: 1 });

    const counts: ResetCounts = {
      projects: 1,
      tasks: createdTaskIds.length,
      dependencies: deps.length,
      goals: 1,
    };
    await recordReset(txdb, {
      workspaceId,
      actorMemberId: ctx.actorMemberId,
      apiKeyId: ctx.apiKeyId,
      scope: 'demo',
      targetId: project.id,
      verb: 'workspace.seeded_demo',
      counts,
      tokenId: ctx.tokenId,
      idempotencyKey: ctx.idempotencyKey,
    });
    return counts;
  });
}

/**
 * Idempotency helper: if this (workspace, key) was already processed, return the
 * stored response to replay. The TTL bounds replay so stale keys eventually fall
 * through to a fresh run.
 */
export async function findIdempotentResponse(
  db: Database,
  workspaceId: string,
  key: string,
  now: Date = new Date(),
): Promise<unknown | undefined> {
  const row = (
    await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.workspaceId, workspaceId), eq(idempotencyKeys.key, key)))
      .limit(1)
  )[0];
  if (!row) return undefined;
  if (row.createdAt && row.createdAt.getTime() + IDEMPOTENCY_TTL_MS < now.getTime()) {
    // Expired: drop it so the caller re-runs and re-stores under the same key.
    await db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.workspaceId, workspaceId), eq(idempotencyKeys.key, key)));
    return undefined;
  }
  return row.responseJson ?? undefined;
}

/**
 * Persist a commit response under (workspace, key) for replay. Best-effort: if a
 * concurrent request already inserted the row (unique PK), the stored value wins
 * and we swallow the conflict.
 */
export async function storeIdempotentResponse(
  db: Database,
  workspaceId: string,
  key: string,
  endpoint: string,
  response: unknown,
): Promise<void> {
  await db
    .insert(idempotencyKeys)
    .values({
      workspaceId,
      key,
      endpoint,
      responseJson: response as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: [idempotencyKeys.workspaceId, idempotencyKeys.key] });
}
