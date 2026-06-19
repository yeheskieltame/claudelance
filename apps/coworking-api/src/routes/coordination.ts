import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { TASK_TYPES, type TaskType } from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { projects } from '../db/schema.js';
import type { AppEnv } from '../lib/context.js';
import { notFound } from '../lib/errors.js';
import { authMiddleware } from '../middleware/auth.js';
import { myOpenTasks, whatsBlockingMe, whatsNext } from '../services/coordination.js';

/** Coerce a `?type` query param to a known TaskType, else undefined (no filter). */
function typeFilter(raw: string | undefined): TaskType | undefined {
  return raw && (TASK_TYPES as readonly string[]).includes(raw) ? (raw as TaskType) : undefined;
}

/** REST surface for the coordination queries (also exposed as MCP "sense" tools). */
export function coordinationRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  r.get('/me/tasks', async (c) => {
    const { workspace, member } = c.get('auth');
    return c.json({ items: await myOpenTasks(db, workspace.id, member.id, typeFilter(c.req.query('type'))) });
  });

  r.get('/me/blocked', async (c) => {
    const { workspace, member } = c.get('auth');
    return c.json({
      items: await whatsBlockingMe(db, workspace.id, member.id, typeFilter(c.req.query('type'))),
    });
  });

  r.get('/projects/:id/next', async (c) => {
    const { workspace, member } = c.get('auth');
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, c.req.param('id')), eq(projects.workspaceId, workspace.id)))
      .limit(1);
    const project = rows[0];
    if (!project) throw notFound('project not found');
    return c.json({ items: await whatsNext(db, project.id, member.id, typeFilter(c.req.query('type'))) });
  });

  return r;
}
