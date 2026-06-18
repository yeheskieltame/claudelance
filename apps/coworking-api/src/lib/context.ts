import type { InferSelectModel } from 'drizzle-orm';

import type { members, workspaces } from '../db/schema.js';

/** Resolved identity for an authenticated request, set by the auth middleware. */
export interface AuthContext {
  workspace: InferSelectModel<typeof workspaces>;
  member: InferSelectModel<typeof members>;
  apiKeyId: string;
}

/** Hono environment: every authed handler can read `c.get('auth')`. */
export type AppEnv = { Variables: { auth: AuthContext } };
