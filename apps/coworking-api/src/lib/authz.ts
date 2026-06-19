// Role + scope authorization helpers. `members.role` (owner|admin|member|viewer)
// and `api_keys.scopes` were previously unenforced; these helpers centralize the
// checks so routes can gate mutations declaratively. The role matrix is:
//   viewer -> read + comment only
//   member -> + task CRUD / claim / move / request-review
//   admin  -> + assign-others / manage-columns / reset
//   owner  -> + delete / role-change
// A scope check (requireScope) additionally narrows what a given API key may do,
// independent of the member's role - both must pass for sensitive actions.

import type { Context } from 'hono';

import type { MemberRole } from '@yeheskieltame/claudelance-coworking-types';

import type { AppEnv } from './context.js';
import { forbidden } from './errors.js';

// Higher number = more privilege. Used for a single >= comparison.
const ROLE_RANK: Record<MemberRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

/**
 * Assert the authenticated member holds at least `min` role. Throws 403 when the
 * member's role outranks-below the requirement. Reads `c.get('auth')`.
 */
export function requireRole(c: Context<AppEnv>, min: MemberRole): void {
  const { member } = c.get('auth');
  const have = ROLE_RANK[member.role as MemberRole] ?? -1;
  if (have < ROLE_RANK[min]) {
    throw forbidden(`requires ${min} role or higher`);
  }
}

/**
 * Assert the authenticated API key carries `scope` (e.g. 'admin', 'write').
 * Throws 403 when missing. Reads `c.get('auth')`.
 */
export function requireScope(c: Context<AppEnv>, scope: string): void {
  const { apiKey } = c.get('auth');
  if (!apiKey?.scopes?.includes(scope)) {
    throw forbidden(`requires the "${scope}" api-key scope`);
  }
}
