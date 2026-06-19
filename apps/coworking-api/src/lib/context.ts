import type { InferSelectModel } from 'drizzle-orm';

import type { apiKeys, members, workspaces } from '../db/schema.js';

/** Resolved identity for an authenticated request, set by the auth middleware. */
export interface AuthContext {
  workspace: InferSelectModel<typeof workspaces>;
  member: InferSelectModel<typeof members>;
  /** The full API-key row (carries `scopes`); used by requireScope. */
  apiKey: InferSelectModel<typeof apiKeys>;
  /** Convenience alias for `apiKey.id`, kept for backward compatibility. */
  apiKeyId: string;
}

/** Hono environment: every authed handler can read `c.get('auth')`. */
export type AppEnv = { Variables: { auth: AuthContext } };
