// Outbound webhook delivery. The activities table IS the event log, so delivery
// is a tailer: scan activities created after a watermark, match them against the
// workspace's enabled webhooks, and POST with an HMAC-SHA256 signature. In-memory
// watermark (per process) starting at boot, mirroring the relayer's keeper.

import { createHmac } from 'node:crypto';

import { and, asc, eq, gt, type InferSelectModel } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { activities, webhooks } from '../db/schema.js';
import { serializeActivity } from '../lib/serialize.js';

/**
 * Deliver every activity created strictly after `since` to matching webhooks.
 * Returns the new watermark (timestamp of the last activity scanned).
 */
export async function deliverPending(
  db: Database,
  fetchImpl: typeof fetch,
  since: Date,
): Promise<Date> {
  const acts = await db
    .select()
    .from(activities)
    .where(gt(activities.createdAt, since))
    .orderBy(asc(activities.createdAt))
    .limit(200);
  if (acts.length === 0) return since;

  const hooksByWorkspace = new Map<string, Array<InferSelectModel<typeof webhooks>>>();
  for (const act of acts) {
    let hooks = hooksByWorkspace.get(act.workspaceId);
    if (!hooks) {
      hooks = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.workspaceId, act.workspaceId), eq(webhooks.enabled, true)));
      hooksByWorkspace.set(act.workspaceId, hooks);
    }
    for (const hook of hooks) {
      if (!hook.events.includes('*') && !hook.events.includes(act.verb)) continue;
      const payload = JSON.stringify({ type: act.verb, activity: serializeActivity(act) });
      const signature = createHmac('sha256', hook.secret).update(payload).digest('hex');
      try {
        const res = await fetchImpl(hook.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-coworking-event': act.verb,
            'x-coworking-signature': `sha256=${signature}`,
          },
          body: payload,
        });
        await db
          .update(webhooks)
          .set({ lastDeliveryAt: new Date(), lastStatus: res.status })
          .where(eq(webhooks.id, hook.id));
      } catch {
        await db
          .update(webhooks)
          .set({ lastDeliveryAt: new Date(), lastStatus: 0 })
          .where(eq(webhooks.id, hook.id));
      }
    }
  }
  return acts[acts.length - 1]!.createdAt;
}

/** Start the background delivery loop. Returns a stop function. */
export function startWebhookWorker(db: Database, intervalMs = 5000): () => void {
  let since = new Date();
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      since = await deliverPending(db, fetch, since);
    } catch {
      // Swallow; the next tick retries from the same watermark.
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(timer);
}
