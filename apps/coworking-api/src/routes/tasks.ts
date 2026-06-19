import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, exists, inArray, isNull, lt, max, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  ACCEPTANCE_CRITERION_KINDS,
  COMPLETION_REASONS,
  DEPENDENCY_TYPES,
  REVIEW_VERDICTS,
  TASK_TYPES,
  type AcceptanceCriterion,
  type DoDItem,
} from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import {
  activities,
  comments,
  labels,
  members,
  projects,
  statusColumns,
  taskDependencies,
  taskLabels,
  taskReviews,
  tasks,
  taskTemplates,
  taskWatchers,
} from '../db/schema.js';
import { requireRole } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { badRequest, conflict, isUniqueViolation, notFound, parse, paymentRequired } from '../lib/errors.js';
import { LIMITS } from '../lib/limits.js';
import { loadTaskScoped } from '../lib/loaders.js';
import {
  serializeComment,
  serializeLabel,
  serializeTask,
  serializeTaskDependency,
  serializeTaskReview,
} from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';
import { renderTemplate } from '../services/templates.js';
import { runAutomations } from '../services/automations.js';

function clampLimit(raw: string | undefined, fallback: number, cap: number): number {
  const n = Number(raw ?? fallback) || fallback;
  return Math.min(Math.max(n, 1), cap);
}

// Zod shape for an acceptance-criterion item supplied on create/patch. ids are
// optional on input (server fills them in); done defaults to false.
const acceptanceCriterionInput = z.object({
  id: z.string().optional(),
  kind: z.enum(ACCEPTANCE_CRITERION_KINDS).optional(),
  text: z.string().min(1).max(2000),
  done: z.boolean().optional(),
  verification: z.string().max(2000).optional(),
  evidenceUrl: z.string().max(2000).optional(),
  evidenceHash: z.string().max(200).optional(),
  checkedBy: z.string().optional(),
  checkedAt: z.string().datetime().optional(),
});

const dodItemInput = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(2000),
  done: z.boolean().optional(),
});

/** Normalize incoming AC items: assign ids, default kind=rule and done=false. */
function normalizeCriteria(items: z.infer<typeof acceptanceCriterionInput>[]): AcceptanceCriterion[] {
  return items.map((it) => ({
    id: it.id ?? randomUUID(),
    kind: it.kind ?? 'rule',
    text: it.text,
    done: it.done ?? false,
    ...(it.verification !== undefined ? { verification: it.verification } : {}),
    ...(it.evidenceUrl !== undefined ? { evidenceUrl: it.evidenceUrl } : {}),
    ...(it.evidenceHash !== undefined ? { evidenceHash: it.evidenceHash } : {}),
    ...(it.checkedBy !== undefined ? { checkedBy: it.checkedBy } : {}),
    ...(it.checkedAt !== undefined ? { checkedAt: it.checkedAt } : {}),
  }));
}

function normalizeDoD(items: z.infer<typeof dodItemInput>[]): DoDItem[] {
  return items.map((it) => ({ id: it.id ?? randomUUID(), text: it.text, done: it.done ?? false }));
}

/** Count done/total across AC + DoD; the inline progress shown on list views. */
function acProgressOf(ac: AcceptanceCriterion[], dod: DoDItem[]): { done: number; total: number } {
  const items = [...ac, ...dod];
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/**
 * If a task is being moved into a completed-category column with unmet
 * acceptance-criteria or DoD items, write a warning comment + activity. This is
 * a WARN, never a block - existing tasks have empty criteria and must stay
 * closeable.
 */
async function warnIfIncomplete(
  db: Database,
  task: { id: string; projectId: string; acceptanceCriteria: unknown; definitionOfDone: unknown },
  workspaceId: string,
  actorMemberId: string | null,
  columnKey: string,
): Promise<void> {
  const ac = Array.isArray(task.acceptanceCriteria)
    ? (task.acceptanceCriteria as AcceptanceCriterion[])
    : [];
  const dod = Array.isArray(task.definitionOfDone) ? (task.definitionOfDone as DoDItem[]) : [];
  const unmet = [...ac, ...dod].filter((i) => !i.done);
  if (unmet.length === 0) return;
  // The status move already committed; this advisory comment + activity is
  // strictly best-effort and must never turn a successful move into a 500.
  // Swallow + log any write failure instead of rethrowing.
  try {
    await db.insert(comments).values({
      taskId: task.id,
      authorMemberId: null,
      body: `Warning: moved to "${columnKey}" with ${unmet.length} unmet acceptance/DoD item(s).`,
    });
    await db.insert(activities).values({
      workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId,
      verb: 'task.completed_with_unmet_criteria',
      payload: { column: columnKey, unmet: unmet.length },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        message: 'coworking.warnIfIncomplete.failed',
        taskId: task.id,
        column: columnKey,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export function taskRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  // Load a task scoped to the caller's workspace (via its project).
  const loadTask = (taskId: string, workspaceId: string) => loadTaskScoped(db, taskId, workspaceId);

  // Validate that the given label ids all belong to a project; returns the ids.
  const validateLabels = async (projectId: string, labelIds: string[]): Promise<string[]> => {
    if (labelIds.length === 0) return [];
    const unique = [...new Set(labelIds)];
    const found = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.projectId, projectId), inArray(labels.id, unique)));
    if (found.length !== unique.length) {
      throw badRequest('one or more labels do not belong to this project', 'invalid_label');
    }
    return unique;
  };

  const createSchema = z.object({
    projectId: z.string().min(1),
    title: z.string().min(1).max(300),
    description: z.string().max(20000).optional(),
    type: z.enum(TASK_TYPES).optional(),
    // Per-type advisory bag: accept any keys, never reject unknowns.
    fields: z.record(z.string(), z.unknown()).optional(),
    acceptanceCriteria: z.array(acceptanceCriterionInput).optional(),
    acceptanceNotes: z.string().max(20000).optional(),
    priority: z.number().int().min(0).max(4).optional(),
    assigneeMemberId: z.string().optional(),
    reviewerMemberId: z.string().optional(),
    parentTaskId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    dueDate: z.string().datetime().optional(),
    estimateMinutes: z.number().int().min(0).optional(),
    estimatePoints: z.number().min(0).optional(),
    labelIds: z.array(z.string()).optional(),
    statusColumnKey: z.string().optional(),
  });

  r.post('/tasks', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const body = parse(createSchema, await c.req.json().catch(() => ({})));

    const projectRows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, body.projectId), eq(projects.workspaceId, workspace.id)))
      .limit(1);
    const project = projectRows[0];
    if (!project) throw notFound('project not found');

    if (LIMITS.enforce && !workspace.isPremium) {
      // Trashed (soft-deleted) tasks must not consume the free-tier quota.
      const rows = await db
        .select({ value: count() })
        .from(tasks)
        .where(and(eq(tasks.projectId, project.id), isNull(tasks.trashedAt)));
      if ((rows[0]?.value ?? 0) >= LIMITS.freeMaxTasksPerProject) {
        throw paymentRequired(
          `Free workspaces are limited to ${LIMITS.freeMaxTasksPerProject} tasks per project. Upgrade to Premium.`,
        );
      }
    }

    const cols = await db
      .select()
      .from(statusColumns)
      .where(eq(statusColumns.projectId, project.id))
      .orderBy(statusColumns.position);
    if (cols.length === 0) throw badRequest('project has no status columns');
    const column = body.statusColumnKey
      ? cols.find((col) => col.key === body.statusColumnKey)
      : cols[0];
    if (!column) throw badRequest(`unknown status column: ${body.statusColumnKey}`, 'unknown_column');

    const labelIds = await validateLabels(project.id, body.labelIds ?? []);
    const ac = normalizeCriteria(body.acceptanceCriteria ?? []);
    // Snapshot the workspace-level DoD template onto the task at creation time.
    const dod = Array.isArray(workspace.definitionOfDone)
      ? (workspace.definitionOfDone as DoDItem[]).map((d) => ({
          id: d.id ?? randomUUID(),
          text: d.text,
          done: false,
        }))
      : [];

    const created = await db.transaction(async (tx) => {
      const agg = await tx
        .select({ value: max(tasks.number) })
        .from(tasks)
        .where(eq(tasks.projectId, project.id));
      const number = (agg[0]?.value ?? 0) + 1;
      const task = (
        await tx
          .insert(tasks)
          .values({
            projectId: project.id,
            number,
            title: body.title,
            description: body.description ?? null,
            type: body.type ?? 'generic',
            fields: body.fields ?? null,
            acceptanceCriteria: ac,
            acceptanceNotes: body.acceptanceNotes ?? null,
            definitionOfDone: dod,
            statusColumnId: column.id,
            assigneeMemberId: body.assigneeMemberId ?? null,
            reviewerMemberId: body.reviewerMemberId ?? null,
            priority: body.priority ?? 0,
            parentTaskId: body.parentTaskId ?? null,
            startDate: body.startDate ? new Date(body.startDate) : null,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            estimateMinutes: body.estimateMinutes ?? null,
            estimatePoints: body.estimatePoints ?? null,
            createdByMemberId: member.id,
          })
          .returning()
      )[0]!;
      if (labelIds.length > 0) {
        await tx.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId: task.id, labelId })));
      }
      // Auto-add the reporter as a watcher (RACI "Informed").
      await tx
        .insert(taskWatchers)
        .values({ taskId: task.id, memberId: member.id })
        .onConflictDoNothing();
      await tx.insert(activities).values({
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: task.id,
        actorMemberId: member.id,
        verb: 'task.created',
        payload: { number, title: task.title, type: task.type },
      });
      return task;
    });

    await runAutomations(db, {
      event: 'task.created',
      task: created,
      workspaceId: workspace.id,
      actorMemberId: member.id,
    });
    return c.json(serializeTask(created), 201);
  });

  r.get('/tasks', async (c) => {
    const { workspace } = c.get('auth');
    const limit = clampLimit(c.req.query('limit'), 50, 100);
    const projectId = c.req.query('projectId');
    const assigneeMemberId = c.req.query('assigneeMemberId');
    const reviewerMemberId = c.req.query('reviewerMemberId');
    const statusKey = c.req.query('status');
    const type = c.req.query('type');
    const label = c.req.query('label'); // label id or name
    const sort = c.req.query('sort'); // priority | dueDate | createdAt (default)
    const cursor = c.req.query('cursor');

    const conds = [eq(projects.workspaceId, workspace.id), isNull(tasks.trashedAt)];
    if (projectId) conds.push(eq(tasks.projectId, projectId));
    if (assigneeMemberId) conds.push(eq(tasks.assigneeMemberId, assigneeMemberId));
    if (reviewerMemberId) conds.push(eq(tasks.reviewerMemberId, reviewerMemberId));
    if (statusKey) conds.push(eq(statusColumns.key, statusKey));
    if (type) conds.push(eq(tasks.type, type));
    if (label) {
      // EXISTS sub-select on the label join keeps the main query free of fan-out.
      conds.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(taskLabels)
            .innerJoin(labels, eq(taskLabels.labelId, labels.id))
            .where(
              and(
                eq(taskLabels.taskId, tasks.id),
                sql`(${labels.id} = ${label} or ${labels.name} = ${label})`,
              ),
            ),
        ),
      );
    }

    // createdAt cursor only applies to the default (createdAt) ordering.
    const useCreatedCursor = (!sort || sort === 'createdAt') && cursor;
    if (useCreatedCursor) conds.push(lt(tasks.createdAt, new Date(cursor!)));

    // Priority: urgent (1) first ... low (4), none (0) last; ties by age.
    const priorityOrder = sql`case when ${tasks.priority} = 0 then 5 else ${tasks.priority} end`;
    const orderBy =
      sort === 'priority'
        ? [priorityOrder, asc(tasks.createdAt)]
        : sort === 'dueDate'
          ? [sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt)]
          : [desc(tasks.createdAt)];

    const rows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
      .where(and(...conds))
      .orderBy(...orderBy)
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const nextCursor =
      !sort || sort === 'createdAt'
        ? rows.length > limit
          ? page[page.length - 1]!.task.createdAt.toISOString()
          : null
        : null;

    // Inline labels in ONE batched query (no N+1), grouped by task id.
    const ids = page.map((row) => row.task.id);
    const labelsByTask = new Map<string, ReturnType<typeof serializeLabel>[]>();
    if (ids.length > 0) {
      const labelRows = await db
        .select({ taskId: taskLabels.taskId, label: labels })
        .from(taskLabels)
        .innerJoin(labels, eq(taskLabels.labelId, labels.id))
        .where(inArray(taskLabels.taskId, ids));
      for (const lr of labelRows) {
        const list = labelsByTask.get(lr.taskId) ?? [];
        list.push(serializeLabel(lr.label));
        labelsByTask.set(lr.taskId, list);
      }
    }

    return c.json({
      items: page.map((row) => {
        const ac = Array.isArray(row.task.acceptanceCriteria)
          ? (row.task.acceptanceCriteria as AcceptanceCriterion[])
          : [];
        const dod = Array.isArray(row.task.definitionOfDone)
          ? (row.task.definitionOfDone as DoDItem[])
          : [];
        return serializeTask(row.task, {
          labels: labelsByTask.get(row.task.id) ?? [],
          acProgress: acProgressOf(ac, dod),
        });
      }),
      nextCursor,
    });
  });

  r.get('/tasks/:id', async (c) => {
    const { workspace } = c.get('auth');
    return c.json(serializeTask(await loadTask(c.req.param('id'), workspace.id)));
  });

  const patchSchema = z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(20000).nullable().optional(),
    type: z.enum(TASK_TYPES).optional(),
    fields: z.record(z.string(), z.unknown()).nullable().optional(),
    acceptanceCriteria: z.array(acceptanceCriterionInput).optional(),
    acceptanceNotes: z.string().max(20000).nullable().optional(),
    definitionOfDone: z.array(dodItemInput).optional(),
    priority: z.number().int().min(0).max(4).optional(),
    reviewerMemberId: z.string().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    estimateMinutes: z.number().int().min(0).nullable().optional(),
    estimatePoints: z.number().min(0).nullable().optional(),
    completionReason: z.enum(COMPLETION_REASONS).nullable().optional(),
  });

  r.patch('/tasks/:id', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const body = parse(patchSchema, await c.req.json().catch(() => ({})));

    // Setting a reviewer is a member-level review-workflow action; validate it
    // belongs to the workspace.
    if (body.reviewerMemberId) {
      const reviewer = (
        await db
          .select({ id: members.id })
          .from(members)
          .where(and(eq(members.id, body.reviewerMemberId), eq(members.workspaceId, workspace.id)))
          .limit(1)
      )[0];
      if (!reviewer) throw notFound('reviewer member not found');
    }

    const updated = (
      await db
        .update(tasks)
        .set({
          updatedAt: new Date(),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.fields !== undefined ? { fields: body.fields } : {}),
          ...(body.acceptanceCriteria !== undefined
            ? { acceptanceCriteria: normalizeCriteria(body.acceptanceCriteria) }
            : {}),
          ...(body.acceptanceNotes !== undefined ? { acceptanceNotes: body.acceptanceNotes } : {}),
          ...(body.definitionOfDone !== undefined
            ? { definitionOfDone: normalizeDoD(body.definitionOfDone) }
            : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.reviewerMemberId !== undefined ? { reviewerMemberId: body.reviewerMemberId } : {}),
          ...(body.startDate !== undefined
            ? { startDate: body.startDate ? new Date(body.startDate) : null }
            : {}),
          ...(body.dueDate !== undefined
            ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
            : {}),
          ...(body.estimateMinutes !== undefined ? { estimateMinutes: body.estimateMinutes } : {}),
          ...(body.estimatePoints !== undefined ? { estimatePoints: body.estimatePoints } : {}),
          ...(body.completionReason !== undefined ? { completionReason: body.completionReason } : {}),
        })
        .where(eq(tasks.id, task.id))
        .returning()
    )[0]!;

    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'task.updated',
      payload: { fields: Object.keys(body) },
    });
    if (body.reviewerMemberId !== undefined && body.reviewerMemberId !== task.reviewerMemberId) {
      await db.insert(activities).values({
        workspaceId: workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        actorMemberId: member.id,
        verb: 'reviewer.assigned',
        payload: { reviewerMemberId: body.reviewerMemberId },
      });
    }
    return c.json(serializeTask(updated));
  });

  const statusSchema = z.object({ statusColumnKey: z.string().min(1) });

  r.post('/tasks/:id/status', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const { statusColumnKey } = parse(statusSchema, await c.req.json().catch(() => ({})));

    const columnRows = await db
      .select()
      .from(statusColumns)
      .where(and(eq(statusColumns.projectId, task.projectId), eq(statusColumns.key, statusColumnKey)))
      .limit(1);
    const column = columnRows[0];
    if (!column) throw notFound(`status column not found: ${statusColumnKey}`);

    const prevRows = await db
      .select()
      .from(statusColumns)
      .where(eq(statusColumns.id, task.statusColumnId))
      .limit(1);
    const fromKey = prevRows[0]?.key ?? null;
    const isCompleted = column.category === 'completed';

    const updated = (
      await db
        .update(tasks)
        .set({
          statusColumnId: column.id,
          completedAt: isCompleted ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, task.id))
        .returning()
    )[0]!;

    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'task.status_changed',
      payload: { from: fromKey, to: column.key },
    });
    if (isCompleted) {
      await db.insert(activities).values({
        workspaceId: workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        actorMemberId: member.id,
        verb: 'task.completed',
        payload: { column: column.key },
      });
      // Non-blocking warn if AC/DoD items remain unmet.
      await warnIfIncomplete(db, task, workspace.id, member.id, column.key);
    }
    await runAutomations(db, {
      event: 'task.status_changed',
      task: updated,
      workspaceId: workspace.id,
      actorMemberId: member.id,
      toColumnKey: column.key,
    });
    return c.json(serializeTask(updated));
  });

  r.post('/tasks/:id/claim', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    if (task.assigneeMemberId && task.assigneeMemberId !== member.id) {
      throw conflict('task already assigned to another member', 'already_assigned');
    }
    const updated = (
      await db
        .update(tasks)
        .set({ assigneeMemberId: member.id, updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
        .returning()
    )[0]!;
    // The assignee (Responsible) auto-watches the task.
    await db
      .insert(taskWatchers)
      .values({ taskId: task.id, memberId: member.id })
      .onConflictDoNothing();
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'task.claimed',
      payload: {},
    });
    return c.json(serializeTask(updated));
  });

  const assignSchema = z.object({ memberId: z.string().min(1) });

  r.post('/tasks/:id/assign', async (c) => {
    // Assigning to ANOTHER member is an admin action (claim is the member path).
    requireRole(c, 'admin');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const { memberId } = parse(assignSchema, await c.req.json().catch(() => ({})));
    const assigneeRows = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.workspaceId, workspace.id)))
      .limit(1);
    const assignee = assigneeRows[0];
    if (!assignee) throw notFound('member not found');
    const updated = (
      await db
        .update(tasks)
        .set({ assigneeMemberId: assignee.id, updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
        .returning()
    )[0]!;
    // The assignee (Responsible) auto-watches the task.
    await db
      .insert(taskWatchers)
      .values({ taskId: task.id, memberId: assignee.id })
      .onConflictDoNothing();
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'task.assigned',
      payload: { assigneeMemberId: assignee.id },
    });
    return c.json(serializeTask(updated));
  });

  // ---- Review loop -----------------------------------------------------------

  /**
   * Find the in-review column for a project (a started-category column flagged
   * "review"), creating a canonical `in_review` one if none exists. After the
   * insert (even when it no-ops on conflict) we re-select the `in_review` row,
   * so the onConflict path resolves to the existing column rather than silently
   * returning null. Falls back to any started column as a last resort.
   */
  const findOrCreateReviewColumn = async (projectId: string) => {
    const cols = await db
      .select()
      .from(statusColumns)
      .where(eq(statusColumns.projectId, projectId))
      .orderBy(statusColumns.position);
    const existing =
      cols.find((col) => col.category === 'started' && /review/i.test(col.key + col.name)) ??
      cols.find((col) => col.key === 'in_review');
    if (existing) return existing;
    // Slot it just after the last started column (or at the end of the board).
    const lastStartedPos = cols.reduce(
      (max, col) => (col.category === 'started' ? Math.max(max, col.position) : max),
      cols.length > 0 ? cols[cols.length - 1]!.position : 0,
    );
    await db
      .insert(statusColumns)
      .values({
        projectId,
        key: 'in_review',
        name: 'In Review',
        category: 'started',
        position: lastStartedPos + 1,
      })
      .onConflictDoNothing();
    // Re-select the in_review row whether we created it or it already existed
    // (onConflictDoNothing). Only if the project has no in_review column AND no
    // started column at all do we return null - the caller turns that into a
    // clear 400 rather than a partial (reviewer-set-but-not-moved) update.
    const resolved = (
      await db
        .select()
        .from(statusColumns)
        .where(and(eq(statusColumns.projectId, projectId), eq(statusColumns.key, 'in_review')))
        .limit(1)
    )[0];
    return resolved ?? cols.find((col) => col.category === 'started') ?? null;
  };

  const requestReviewSchema = z.object({
    reviewerMemberId: z.string().optional(),
    statusColumnKey: z.string().optional(),
  });

  r.post('/tasks/:id/request-review', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const body = parse(requestReviewSchema, await c.req.json().catch(() => ({})));

    // Resolve the reviewer: explicit > existing > assignee. Validate ownership.
    const reviewerMemberId = body.reviewerMemberId ?? task.reviewerMemberId ?? task.assigneeMemberId;
    if (body.reviewerMemberId) {
      const reviewer = (
        await db
          .select({ id: members.id })
          .from(members)
          .where(and(eq(members.id, body.reviewerMemberId), eq(members.workspaceId, workspace.id)))
          .limit(1)
      )[0];
      if (!reviewer) throw notFound('reviewer member not found');
    }

    // Resolve the target column: explicit key if given, else find/create review.
    let column;
    if (body.statusColumnKey) {
      column = (
        await db
          .select()
          .from(statusColumns)
          .where(
            and(eq(statusColumns.projectId, task.projectId), eq(statusColumns.key, body.statusColumnKey)),
          )
          .limit(1)
      )[0];
      if (!column) throw notFound(`status column not found: ${body.statusColumnKey}`);
    } else {
      column = await findOrCreateReviewColumn(task.projectId);
    }
    // Never do a partial update (reviewer set but task not moved): if no review
    // or started column can be resolved, the board is misconfigured.
    if (!column) {
      throw badRequest(
        'no review or started column on this board to move the task into; configure a started-category column (e.g. "in_review")',
        'no_review_column',
      );
    }

    const reviewerChanged = reviewerMemberId !== task.reviewerMemberId;
    const updated = (
      await db
        .update(tasks)
        .set({
          reviewerMemberId: reviewerMemberId ?? null,
          statusColumnId: column.id,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, task.id))
        .returning()
    )[0]!;

    // Reviewer becomes a watcher (RACI "Informed" while accountable for review).
    if (reviewerMemberId) {
      await db
        .insert(taskWatchers)
        .values({ taskId: task.id, memberId: reviewerMemberId })
        .onConflictDoNothing();
    }

    if (reviewerChanged && reviewerMemberId) {
      await db.insert(activities).values({
        workspaceId: workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        actorMemberId: member.id,
        verb: 'reviewer.assigned',
        payload: { reviewerMemberId },
      });
    }
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'review.requested',
      payload: { reviewerMemberId: reviewerMemberId ?? null, column: column.key },
    });
    // Surface to subscribers (webhook/automation) as a status change.
    await runAutomations(db, {
      event: 'task.status_changed',
      task: updated,
      workspaceId: workspace.id,
      actorMemberId: member.id,
      toColumnKey: column.key,
    });
    return c.json(serializeTask(updated));
  });

  const reviewSchema = z.object({
    verdict: z.enum(REVIEW_VERDICTS),
    comment: z.string().max(20000).optional(),
    score: z.number().int().min(1).max(5).optional(),
  });

  r.post('/tasks/:id/review', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    // A reviewer must be assigned first (via request-review). Without one, any
    // member could drive a task to completed/canceled - reject before any write.
    if (!task.reviewerMemberId) {
      throw conflict('no reviewer assigned; call request-review first', 'no_reviewer_assigned');
    }
    // Only the accountable reviewer (or an admin) may record a verdict.
    if (task.reviewerMemberId !== member.id) {
      requireRole(c, 'admin');
    }
    const body = parse(reviewSchema, await c.req.json().catch(() => ({})));

    const cols = await db
      .select()
      .from(statusColumns)
      .where(eq(statusColumns.projectId, task.projectId))
      .orderBy(statusColumns.position);

    // Resolve the destination column BEFORE recording the verdict. Each verdict
    // drives the task to a terminal/back column:
    //  approved           -> completed column (completedAt + reason 'completed')
    //  changes_requested  -> back to a started, non-review column (the back-edge)
    //  rejected           -> canceled column (reason 'canceled')
    // If the board has no such column the move would silently no-op, leaving the
    // task where it is while callers/watchers believe it moved. Refuse instead so
    // the verdict + activity are only written when the move actually happens.
    let destCol;
    let move: { completedAt: Date | null; completionReason?: 'completed' | 'canceled' };
    if (body.verdict === 'approved') {
      destCol = cols.find((col) => col.category === 'completed');
      if (!destCol) {
        throw conflict(
          'no completed-category column on this board; configure one to approve tasks',
          'no_completed_column',
        );
      }
      move = { completedAt: new Date(), completionReason: 'completed' };
    } else if (body.verdict === 'changes_requested') {
      destCol = cols.find((col) => col.category === 'started' && !/review/i.test(col.key + col.name));
      if (!destCol) {
        throw conflict(
          'no started-category (non-review) column on this board to send the task back to; configure one (e.g. "in_progress")',
          'no_in_progress_column',
        );
      }
      move = { completedAt: null };
    } else {
      // rejected
      destCol = cols.find((col) => col.category === 'canceled');
      if (!destCol) {
        throw conflict(
          'no canceled-category column on this board; configure one to reject tasks',
          'no_canceled_column',
        );
      }
      move = { completedAt: null, completionReason: 'canceled' };
    }

    // The move is guaranteed: apply it, then record the verdict + activity.
    await db
      .update(tasks)
      .set({
        statusColumnId: destCol.id,
        completedAt: move.completedAt,
        ...(move.completionReason !== undefined ? { completionReason: move.completionReason } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));
    const movedTo = destCol.key;

    const review = (
      await db
        .insert(taskReviews)
        .values({
          taskId: task.id,
          reviewerMemberId: member.id,
          verdict: body.verdict,
          comment: body.comment ?? null,
          score: body.score ?? null,
        })
        .returning()
    )[0]!;

    const verb =
      body.verdict === 'approved'
        ? 'review.approved'
        : body.verdict === 'changes_requested'
          ? 'review.changes_requested'
          : 'review.rejected';
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb,
      payload: { verdict: body.verdict, score: body.score ?? null, movedTo },
    });
    // changes_requested re-opens the task for the assignee.
    if (body.verdict === 'changes_requested') {
      await db.insert(activities).values({
        workspaceId: workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        actorMemberId: member.id,
        verb: 'task.reopened',
        payload: { column: movedTo },
      });
    }
    return c.json(serializeTaskReview(review), 201);
  });

  r.get('/tasks/:id/reviews', async (c) => {
    const { workspace } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const rows = await db
      .select()
      .from(taskReviews)
      .where(eq(taskReviews.taskId, task.id))
      .orderBy(taskReviews.createdAt);
    return c.json({ items: rows.map(serializeTaskReview) });
  });

  // ---- Watchers (RACI "Informed") --------------------------------------------

  r.get('/tasks/:id/watchers', async (c) => {
    const { workspace } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const rows = await db
      .select({ memberId: taskWatchers.memberId, createdAt: taskWatchers.createdAt })
      .from(taskWatchers)
      .where(eq(taskWatchers.taskId, task.id));
    return c.json({
      items: rows.map((w) => ({ taskId: task.id, memberId: w.memberId, createdAt: w.createdAt.toISOString() })),
    });
  });

  const watcherSchema = z.object({ memberId: z.string().optional() });

  r.post('/tasks/:id/watchers', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const body = parse(watcherSchema, await c.req.json().catch(() => ({})));
    const memberId = body.memberId ?? member.id;
    const target = (
      await db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.id, memberId), eq(members.workspaceId, workspace.id)))
        .limit(1)
    )[0];
    if (!target) throw notFound('member not found');
    await db.insert(taskWatchers).values({ taskId: task.id, memberId }).onConflictDoNothing();
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'watcher.added',
      payload: { memberId },
    });
    return c.json({ taskId: task.id, memberId }, 201);
  });

  r.delete('/tasks/:id/watchers/:memberId', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const memberId = c.req.param('memberId');
    const deleted = await db
      .delete(taskWatchers)
      .where(and(eq(taskWatchers.taskId, task.id), eq(taskWatchers.memberId, memberId)))
      .returning();
    if (deleted.length === 0) throw notFound('watcher not found');
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'watcher.removed',
      payload: { memberId },
    });
    return c.json({ ok: true });
  });

  // ---- Soft-delete (trash / restore) -----------------------------------------

  r.delete('/tasks/:id', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    if (task.trashedAt) return c.json(serializeTask(task)); // already trashed -> idempotent
    const updated = (
      await db
        .update(tasks)
        .set({ trashedAt: new Date(), trashedByMemberId: member.id, updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'task.trashed',
      payload: {},
    });
    return c.json(serializeTask(updated));
  });

  r.post('/tasks/:id/restore', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const updated = (
      await db
        .update(tasks)
        .set({ trashedAt: null, trashedByMemberId: null, updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'task.restored',
      payload: {},
    });
    return c.json(serializeTask(updated));
  });

  // ---- Instantiate from a template -------------------------------------------

  const fromTemplateSchema = z.object({
    projectId: z.string().min(1),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(20000).nullable().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    estimateMinutes: z.number().int().min(0).nullable().optional(),
    statusColumnKey: z.string().optional(),
    assigneeMemberId: z.string().optional(),
    reviewerMemberId: z.string().optional(),
    vars: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
  });

  r.post('/tasks/from-template/:templateId', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const body = parse(fromTemplateSchema, await c.req.json().catch(() => ({})));

    const project = (
      await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, body.projectId), eq(projects.workspaceId, workspace.id)))
        .limit(1)
    )[0];
    if (!project) throw notFound('project not found');

    // Template must belong to the workspace; project-scoped templates must match.
    const template = (
      await db
        .select()
        .from(taskTemplates)
        .where(
          and(eq(taskTemplates.id, c.req.param('templateId')), eq(taskTemplates.workspaceId, workspace.id)),
        )
        .limit(1)
    )[0];
    if (!template) throw notFound('template not found');
    if (template.projectId && template.projectId !== project.id) {
      throw badRequest('template is scoped to a different project', 'template_project_mismatch');
    }

    if (LIMITS.enforce && !workspace.isPremium) {
      // Trashed (soft-deleted) tasks must not consume the free-tier quota.
      const rows = await db
        .select({ value: count() })
        .from(tasks)
        .where(and(eq(tasks.projectId, project.id), isNull(tasks.trashedAt)));
      if ((rows[0]?.value ?? 0) >= LIMITS.freeMaxTasksPerProject) {
        throw paymentRequired(
          `Free workspaces are limited to ${LIMITS.freeMaxTasksPerProject} tasks per project. Upgrade to Premium.`,
        );
      }
    }

    let rendered;
    try {
      rendered = renderTemplate(template, {
        description: body.description,
        priority: body.priority as 0 | 1 | 2 | 3 | 4 | undefined,
        estimateMinutes: body.estimateMinutes,
        vars: body.vars,
        fields: body.fields,
      });
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : 'template render failed', 'template_invalid');
    }

    const cols = await db
      .select()
      .from(statusColumns)
      .where(eq(statusColumns.projectId, project.id))
      .orderBy(statusColumns.position);
    if (cols.length === 0) throw badRequest('project has no status columns');
    const column = body.statusColumnKey ? cols.find((col) => col.key === body.statusColumnKey) : cols[0];
    if (!column) throw badRequest(`unknown status column: ${body.statusColumnKey}`, 'unknown_column');

    // Map the template's default label names to existing project label ids.
    let labelIds: string[] = [];
    if (rendered.defaultLabels.length > 0) {
      const found = await db
        .select({ id: labels.id })
        .from(labels)
        .where(and(eq(labels.projectId, project.id), inArray(labels.name, rendered.defaultLabels)));
      labelIds = found.map((l) => l.id);
    }

    const dod = Array.isArray(workspace.definitionOfDone)
      ? (workspace.definitionOfDone as DoDItem[]).map((d) => ({
          id: d.id ?? randomUUID(),
          text: d.text,
          done: false,
        }))
      : [];

    const created = await db.transaction(async (tx) => {
      const agg = await tx
        .select({ value: max(tasks.number) })
        .from(tasks)
        .where(eq(tasks.projectId, project.id));
      const number = (agg[0]?.value ?? 0) + 1;
      const task = (
        await tx
          .insert(tasks)
          .values({
            projectId: project.id,
            number,
            title: body.title ?? template.name,
            description: rendered.description,
            type: rendered.type,
            fields: rendered.fields,
            acceptanceCriteria: rendered.acceptanceCriteria,
            definitionOfDone: dod,
            statusColumnId: column.id,
            assigneeMemberId: body.assigneeMemberId ?? null,
            reviewerMemberId: body.reviewerMemberId ?? null,
            priority: rendered.priority ?? 0,
            estimateMinutes: rendered.estimateMinutes ?? null,
            createdByMemberId: member.id,
          })
          .returning()
      )[0]!;
      if (labelIds.length > 0) {
        await tx.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId: task.id, labelId })));
      }
      await tx
        .insert(taskWatchers)
        .values({ taskId: task.id, memberId: member.id })
        .onConflictDoNothing();
      await tx.insert(activities).values({
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: task.id,
        actorMemberId: member.id,
        verb: 'task.from_template',
        payload: { templateId: template.id, number, type: task.type },
      });
      return task;
    });

    await runAutomations(db, {
      event: 'task.created',
      task: created,
      workspaceId: workspace.id,
      actorMemberId: member.id,
    });
    return c.json(serializeTask(created), 201);
  });

  // ---- Comments --------------------------------------------------------------

  r.get('/tasks/:id/comments', async (c) => {
    const { workspace } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, task.id))
      .orderBy(comments.createdAt);
    return c.json({ items: rows.map(serializeComment) });
  });

  const commentSchema = z.object({ body: z.string().min(1).max(20000) });

  r.post('/tasks/:id/comments', async (c) => {
    // Viewers may comment (read + comment); no role gate beyond authentication.
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const { body } = parse(commentSchema, await c.req.json().catch(() => ({})));
    const comment = (
      await db
        .insert(comments)
        .values({ taskId: task.id, authorMemberId: member.id, body })
        .returning()
    )[0]!;
    // Commenting on a task subscribes you to it (the "Informed" set).
    await db
      .insert(taskWatchers)
      .values({ taskId: task.id, memberId: member.id })
      .onConflictDoNothing();
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'comment.added',
      payload: { commentId: comment.id },
    });
    return c.json(serializeComment(comment), 201);
  });

  // ---- Dependencies ----------------------------------------------------------

  const depSchema = z.object({
    blockerTaskId: z.string().min(1),
    type: z.enum(DEPENDENCY_TYPES).optional(),
  });

  r.post('/tasks/:id/dependencies', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const blocked = await loadTask(c.req.param('id'), workspace.id);
    const { blockerTaskId, type } = parse(depSchema, await c.req.json().catch(() => ({})));
    if (blockerTaskId === blocked.id) throw badRequest('a task cannot depend on itself');
    const blocker = await loadTask(blockerTaskId, workspace.id);
    try {
      const dep = (
        await db
          .insert(taskDependencies)
          .values({ blockerTaskId: blocker.id, blockedTaskId: blocked.id, type: type ?? 'blocks' })
          .returning()
      )[0]!;
      await db.insert(activities).values({
        workspaceId: workspace.id,
        projectId: blocked.projectId,
        taskId: blocked.id,
        actorMemberId: member.id,
        verb: 'dependency.added',
        payload: { blockerTaskId: blocker.id, type: dep.type },
      });
      return c.json(serializeTaskDependency(dep), 201);
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('that dependency already exists');
      throw err;
    }
  });

  r.delete('/tasks/:id/dependencies/:depId', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const blocked = await loadTask(c.req.param('id'), workspace.id);
    const deleted = await db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.id, c.req.param('depId')),
          eq(taskDependencies.blockedTaskId, blocked.id),
        ),
      )
      .returning();
    if (deleted.length === 0) throw notFound('dependency not found');
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: blocked.projectId,
      taskId: blocked.id,
      actorMemberId: member.id,
      verb: 'dependency.resolved',
      payload: { dependencyId: c.req.param('depId') },
    });
    return c.json({ ok: true });
  });

  // ---- Labels (replace the task's full label set) ----------------------------

  const setLabelsSchema = z.object({ labelIds: z.array(z.string()) });

  r.put('/tasks/:id/labels', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const body = parse(setLabelsSchema, await c.req.json().catch(() => ({})));
    // Labels must belong to the task's own project.
    const labelIds = await validateLabels(task.projectId, body.labelIds);

    const applied = await db.transaction(async (tx) => {
      await tx.delete(taskLabels).where(eq(taskLabels.taskId, task.id));
      if (labelIds.length > 0) {
        await tx.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId: task.id, labelId })));
      }
      // Return the now-current labels for the inline view.
      return tx
        .select({ label: labels })
        .from(taskLabels)
        .innerJoin(labels, eq(taskLabels.labelId, labels.id))
        .where(eq(taskLabels.taskId, task.id));
    });

    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'task.labels_set',
      payload: { labelIds },
    });
    return c.json(serializeTask(task, { labels: applied.map((a) => serializeLabel(a.label)) }));
  });

  return r;
}
