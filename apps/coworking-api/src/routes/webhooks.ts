import { randomBytes } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import { webhooks } from '../db/schema.js';
import { requireRole } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { notFound, parse } from '../lib/errors.js';
import { serializeWebhook } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Outbound webhook registrations. Deliveries are signed HMAC-SHA256 with the
 * webhook secret (returned once at creation) and carry x-coworking-event /
 * x-coworking-signature headers. The delivery worker tails the activity feed.
 */
export function webhookRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  const createSchema = z.object({
    url: z.string().url(),
    events: z.array(z.string()).optional(),
    secret: z.string().min(8).max(200).optional(),
  });

  r.post('/webhooks', async (c) => {
    const { workspace } = c.get('auth');
    // A webhook tails the whole activity feed to an arbitrary URL, so registering
    // one is an admin/integration action - not something a viewer key may do.
    requireRole(c, 'admin');
    const body = parse(createSchema, await c.req.json().catch(() => ({})));
    const secret = body.secret ?? randomBytes(24).toString('hex');
    const hook = (
      await db
        .insert(webhooks)
        .values({
          workspaceId: workspace.id,
          url: body.url,
          secret,
          events: body.events ?? ['*'],
          enabled: true,
        })
        .returning()
    )[0]!;
    // Secret is shown once so the receiver can verify signatures.
    return c.json({ ...serializeWebhook(hook), secret }, 201);
  });

  r.get('/webhooks', async (c) => {
    const { workspace } = c.get('auth');
    const rows = await db.select().from(webhooks).where(eq(webhooks.workspaceId, workspace.id));
    return c.json({ items: rows.map(serializeWebhook) });
  });

  r.delete('/webhooks/:id', async (c) => {
    const { workspace } = c.get('auth');
    requireRole(c, 'admin');
    const deleted = await db
      .delete(webhooks)
      .where(and(eq(webhooks.id, c.req.param('id')), eq(webhooks.workspaceId, workspace.id)))
      .returning();
    if (deleted.length === 0) throw notFound('webhook not found');
    return c.json({ ok: true });
  });

  return r;
}
