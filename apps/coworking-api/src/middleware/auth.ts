import { and, eq, isNull } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';

import type { Database } from '../db/client.js';
import { apiKeys, members, workspaces } from '../db/schema.js';
import { hashApiKey } from '../lib/apikey.js';
import type { AppEnv } from '../lib/context.js';
import { unauthorized } from '../lib/errors.js';

/**
 * Bearer API-key auth. Resolves the key to its member + workspace and attaches
 * them to the request context. Every route mounted behind this can read
 * `c.get('auth')`. Keys are looked up by sha256 hash; revoked keys are rejected.
 */
export function authMiddleware(db: Database): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) throw unauthorized('missing bearer api key');

    const keyRows = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, hashApiKey(token)), isNull(apiKeys.revokedAt)))
      .limit(1);
    const key = keyRows[0];
    if (!key) throw unauthorized('invalid or revoked api key');

    const memberRows = await db.select().from(members).where(eq(members.id, key.memberId)).limit(1);
    const workspaceRows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, key.workspaceId))
      .limit(1);
    const member = memberRows[0];
    const workspace = workspaceRows[0];
    if (!member || !workspace) throw unauthorized('api key has no member or workspace');

    c.set('auth', { workspace, member, apiKey: key, apiKeyId: key.id });
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
    await next();
  };
}
