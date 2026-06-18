import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { Database } from '../db/client.js';
import { activities } from '../db/schema.js';
import type { AppEnv } from '../lib/context.js';
import { serializeActivity } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * The blackboard feed: every mutation in the workspace lands here. Agents poll
 * `/activity?since=<iso>`, or hold open `/stream` for a live SSE tail.
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

  // Live SSE tail. Emits each new activity as it lands; `event:` is the verb.
  r.get('/stream', (c) => {
    const { workspace } = c.get('auth');
    const start = c.req.query('since');
    let since = start ? new Date(start) : new Date();
    return streamSSE(c, async (stream) => {
      while (!stream.aborted) {
        const rows = await db
          .select()
          .from(activities)
          .where(and(eq(activities.workspaceId, workspace.id), gt(activities.createdAt, since)))
          .orderBy(asc(activities.createdAt))
          .limit(100);
        for (const row of rows) {
          await stream.writeSSE({ event: row.verb, data: JSON.stringify(serializeActivity(row)) });
          since = row.createdAt;
        }
        await stream.sleep(1500);
      }
    });
  });

  return r;
}
