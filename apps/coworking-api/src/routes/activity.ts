import { and, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../db/client.js';
import { activities } from '../db/schema.js';
import type { AppEnv } from '../lib/context.js';
import { serializeActivity } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * The blackboard feed: every mutation in the workspace lands here. Agents poll
 * `?since=<iso>` to learn what changed without re-reading the whole board.
 */
export function activityRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  r.get('/activity', async (c) => {
    const { workspace } = c.get('auth');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
    const projectId = c.req.query('projectId');
    const since = c.req.query('since');

    const conds = [eq(activities.workspaceId, workspace.id)];
    if (projectId) conds.push(eq(activities.projectId, projectId));
    if (since) conds.push(gt(activities.createdAt, new Date(since)));

    const rows = await db
      .select()
      .from(activities)
      .where(and(...conds))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
    return c.json({ items: rows.map(serializeActivity) });
  });

  return r;
}
