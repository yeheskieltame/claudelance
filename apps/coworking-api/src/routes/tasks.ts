import { and, desc, eq, lt, max } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import {
  activities,
  comments,
  members,
  projects,
  statusColumns,
  taskDependencies,
  tasks,
} from '../db/schema.js';
import type { AppEnv } from '../lib/context.js';
import { badRequest, conflict, isUniqueViolation, notFound, parse } from '../lib/errors.js';
import { loadTaskScoped } from '../lib/loaders.js';
import {
  serializeComment,
  serializeTask,
  serializeTaskDependency,
} from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

function clampLimit(raw: string | undefined, fallback: number, cap: number): number {
  const n = Number(raw ?? fallback) || fallback;
  return Math.min(Math.max(n, 1), cap);
}

export function taskRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  // Load a task scoped to the caller's workspace (via its project).
  const loadTask = (taskId: string, workspaceId: string) => loadTaskScoped(db, taskId, workspaceId);

  const createSchema = z.object({
    projectId: z.string().min(1),
    title: z.string().min(1).max(300),
    description: z.string().max(20000).optional(),
    priority: z.number().int().min(0).max(4).optional(),
    assigneeMemberId: z.string().optional(),
    parentTaskId: z.string().optional(),
    dueDate: z.string().datetime().optional(),
    statusColumnKey: z.string().optional(),
  });

  r.post('/tasks', async (c) => {
    const { workspace, member } = c.get('auth');
    const body = parse(createSchema, await c.req.json().catch(() => ({})));

    const projectRows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, body.projectId), eq(projects.workspaceId, workspace.id)))
      .limit(1);
    const project = projectRows[0];
    if (!project) throw notFound('project not found');

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
            statusColumnId: column.id,
            assigneeMemberId: body.assigneeMemberId ?? null,
            priority: body.priority ?? 0,
            parentTaskId: body.parentTaskId ?? null,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            createdByMemberId: member.id,
          })
          .returning()
      )[0]!;
      await tx.insert(activities).values({
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: task.id,
        actorMemberId: member.id,
        verb: 'task.created',
        payload: { number, title: task.title },
      });
      return task;
    });

    return c.json(serializeTask(created), 201);
  });

  r.get('/tasks', async (c) => {
    const { workspace } = c.get('auth');
    const limit = clampLimit(c.req.query('limit'), 50, 100);
    const projectId = c.req.query('projectId');
    const assigneeMemberId = c.req.query('assigneeMemberId');
    const statusKey = c.req.query('status');
    const cursor = c.req.query('cursor');

    const conds = [eq(projects.workspaceId, workspace.id)];
    if (projectId) conds.push(eq(tasks.projectId, projectId));
    if (assigneeMemberId) conds.push(eq(tasks.assigneeMemberId, assigneeMemberId));
    if (statusKey) conds.push(eq(statusColumns.key, statusKey));
    if (cursor) conds.push(lt(tasks.createdAt, new Date(cursor)));

    const rows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
      .where(and(...conds))
      .orderBy(desc(tasks.createdAt))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? page[page.length - 1]!.task.createdAt.toISOString() : null;
    return c.json({ items: page.map((row) => serializeTask(row.task)), nextCursor });
  });

  r.get('/tasks/:id', async (c) => {
    const { workspace } = c.get('auth');
    return c.json(serializeTask(await loadTask(c.req.param('id'), workspace.id)));
  });

  const patchSchema = z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(20000).nullable().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    estimateMinutes: z.number().int().min(0).nullable().optional(),
  });

  r.patch('/tasks/:id', async (c) => {
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const body = parse(patchSchema, await c.req.json().catch(() => ({})));
    const updated = (
      await db
        .update(tasks)
        .set({
          updatedAt: new Date(),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.dueDate !== undefined
            ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
            : {}),
          ...(body.estimateMinutes !== undefined ? { estimateMinutes: body.estimateMinutes } : {}),
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
    return c.json(serializeTask(updated));
  });

  const statusSchema = z.object({ statusColumnKey: z.string().min(1) });

  r.post('/tasks/:id/status', async (c) => {
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
    }
    return c.json(serializeTask(updated));
  });

  r.post('/tasks/:id/claim', async (c) => {
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
    const { workspace, member } = c.get('auth');
    const task = await loadTask(c.req.param('id'), workspace.id);
    const { body } = parse(commentSchema, await c.req.json().catch(() => ({})));
    const comment = (
      await db
        .insert(comments)
        .values({ taskId: task.id, authorMemberId: member.id, body })
        .returning()
    )[0]!;
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

  const depSchema = z.object({
    blockerTaskId: z.string().min(1),
    type: z.enum(['blocks', 'relates_to', 'duplicates']).optional(),
  });

  r.post('/tasks/:id/dependencies', async (c) => {
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

  return r;
}
