import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import { activities, timeEntries } from '../db/schema.js';
import type { AppEnv } from '../lib/context.js';
import { notFound, parse } from '../lib/errors.js';
import { loadTaskScoped } from '../lib/loaders.js';
import { serializeTimeEntry } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

/** Time tracking: start/stop a timer or log time manually, per task. */
export function timeRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  const openEntry = (taskId: string, memberId: string) =>
    db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.taskId, taskId),
          eq(timeEntries.memberId, memberId),
          isNull(timeEntries.endedAt),
        ),
      )
      .orderBy(desc(timeEntries.startedAt))
      .limit(1);

  r.post('/tasks/:id/check-in', async (c) => {
    const { workspace, member } = c.get('auth');
    const task = await loadTaskScoped(db, c.req.param('id'), workspace.id);
    const existing = (await openEntry(task.id, member.id))[0];
    if (existing) return c.json(serializeTimeEntry(existing)); // already running -> idempotent
    const entry = (
      await db
        .insert(timeEntries)
        .values({ taskId: task.id, memberId: member.id, startedAt: new Date(), source: 'timer' })
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'time.checked_in',
      payload: { timeEntryId: entry.id },
    });
    return c.json(serializeTimeEntry(entry), 201);
  });

  r.post('/tasks/:id/check-out', async (c) => {
    const { workspace, member } = c.get('auth');
    const task = await loadTaskScoped(db, c.req.param('id'), workspace.id);
    const open = (await openEntry(task.id, member.id))[0];
    if (!open) throw notFound('no open time entry to check out');
    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - open.startedAt.getTime()) / 1000),
    );
    const updated = (
      await db
        .update(timeEntries)
        .set({ endedAt, durationSeconds })
        .where(eq(timeEntries.id, open.id))
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'time.checked_out',
      payload: { timeEntryId: open.id, durationSeconds },
    });
    return c.json(serializeTimeEntry(updated));
  });

  const logSchema = z.object({
    minutes: z.number().int().min(1).max(100000),
    note: z.string().max(2000).optional(),
    startedAt: z.string().datetime().optional(),
  });

  r.post('/tasks/:id/time', async (c) => {
    const { workspace, member } = c.get('auth');
    const task = await loadTaskScoped(db, c.req.param('id'), workspace.id);
    const body = parse(logSchema, await c.req.json().catch(() => ({})));
    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
    const durationSeconds = body.minutes * 60;
    const entry = (
      await db
        .insert(timeEntries)
        .values({
          taskId: task.id,
          memberId: member.id,
          startedAt,
          endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
          durationSeconds,
          source: 'manual',
          note: body.note ?? null,
        })
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      actorMemberId: member.id,
      verb: 'time.checked_out',
      payload: { timeEntryId: entry.id, durationSeconds, manual: true },
    });
    return c.json(serializeTimeEntry(entry), 201);
  });

  r.get('/tasks/:id/time', async (c) => {
    const { workspace } = c.get('auth');
    const task = await loadTaskScoped(db, c.req.param('id'), workspace.id);
    const rows = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.taskId, task.id))
      .orderBy(desc(timeEntries.startedAt));
    const totalSeconds = rows.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0);
    return c.json({ items: rows.map(serializeTimeEntry), totalSeconds });
  });

  return r;
}
