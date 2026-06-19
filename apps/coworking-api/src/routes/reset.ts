// Destructive reset endpoints (REST-only - MCP never exposes the commit path).
//
// Every endpoint is a two-call handshake:
//   dry-run : POST { dryRun: true }            -> ResetPreview (counts + token)
//   commit  : POST { confirmationToken, confirm: true } + `Idempotency-Key` header
//             -> ResetResult
//
// All are gated by requireRole('admin') AND requireScope('admin') AND
// workspace.allowReset !== false (403 reset_disabled otherwise). The reset is a
// recoverable SOFT-DELETE: see services/reset.ts. seed-demo is non-destructive
// (it only creates rows) but shares the same handshake for a consistent UX.

import { type Context, Hono } from 'hono';
import { z } from 'zod';

import type { ResetPreview, ResetResult, ResetScope } from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { requireRole, requireScope } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { badRequest, forbidden, parse } from '../lib/errors.js';
import { loadProjectScoped } from '../lib/loaders.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  computeResetPreview,
  consumeResetToken,
  findIdempotentResponse,
  issueResetToken,
  performProjectReset,
  performWorkspaceClear,
  seedDemo,
  storeIdempotentResponse,
  type PerformContext,
} from '../services/reset.js';

/** Request body shared by all reset endpoints; a discriminated dry-run/commit. */
const resetBodySchema = z.object({
  dryRun: z.boolean().optional(),
  confirm: z.boolean().optional(),
  confirmationToken: z.string().optional(),
  // project reset only: rebuild the board to the default columns.
  restoreDefaultColumns: z.boolean().optional(),
  // seed-demo only: allow seeding into a non-empty workspace.
  force: z.boolean().optional(),
});

export function resetRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  /** Gate: admin role + admin scope + workspace.allowReset. Returns nothing. */
  const gate = (c: Context<AppEnv>): void => {
    requireRole(c, 'admin');
    requireScope(c, 'admin');
    const { workspace } = c.get('auth');
    if (workspace.allowReset === false) {
      throw forbidden('reset is disabled for this workspace');
    }
  };

  const preview = (
    scope: ResetScope,
    targetId: string | null,
    counts: Record<string, number>,
    confirmationToken: string,
    expiresAt: Date,
  ): ResetPreview => ({ scope, targetId, counts, confirmationToken, expiresAt: expiresAt.toISOString() });

  const result = (scope: ResetScope, targetId: string | null, counts: Record<string, number>): ResetResult => ({
    scope,
    targetId,
    counts,
    performedAt: new Date().toISOString(),
  });

  // ---- POST /projects/:id/reset ----------------------------------------------
  r.post('/projects/:id/reset', async (c) => {
    gate(c);
    const { workspace, member, apiKey } = c.get('auth');
    const project = await loadProjectScoped(db, c.req.param('id'), workspace.id);
    const body = parse(resetBodySchema, await c.req.json().catch(() => ({})));

    // Dry-run: report counts + issue a token bound to the current counts hash.
    if (!body.confirm) {
      const { willDelete, countsHash } = await computeResetPreview(db, workspace.id, 'project', project.id);
      const token = await issueResetToken(db, {
        workspaceId: workspace.id,
        scope: 'project',
        targetId: project.id,
        countsHash,
        createdByMemberId: member.id,
      });
      return c.json(preview('project', project.id, willDelete, token.id, token.expiresAt));
    }

    // Commit: requires a confirmation token + an Idempotency-Key header.
    if (!body.confirmationToken) throw badRequest('confirmationToken is required to commit', 'confirmation_required');
    const idempotencyKey = requireIdempotencyKey(c);
    const replay = await findIdempotentResponse(db, workspace.id, idempotencyKey);
    if (replay !== undefined) return c.json(replay as ResetResult);

    await consumeResetToken(db, {
      workspaceId: workspace.id,
      tokenId: body.confirmationToken,
      scope: 'project',
      targetId: project.id,
    });
    const ctx: PerformContext = {
      workspaceId: workspace.id,
      actorMemberId: member.id,
      apiKeyId: apiKey?.id ?? null,
      tokenId: body.confirmationToken,
      idempotencyKey,
    };
    const counts = await performProjectReset(
      db,
      { id: project.id, workspaceId: workspace.id },
      { restoreDefaultColumns: body.restoreDefaultColumns },
      ctx,
    );
    const out = result('project', project.id, counts);
    await storeIdempotentResponse(db, workspace.id, idempotencyKey, 'projects/:id/reset', out);
    return c.json(out);
  });

  // ---- POST /workspaces/current/reset ----------------------------------------
  r.post('/workspaces/current/reset', async (c) => {
    gate(c);
    const { workspace, member, apiKey } = c.get('auth');
    const body = parse(resetBodySchema, await c.req.json().catch(() => ({})));

    if (!body.confirm) {
      const { willDelete, countsHash } = await computeResetPreview(db, workspace.id, 'workspace', null);
      const token = await issueResetToken(db, {
        workspaceId: workspace.id,
        scope: 'workspace',
        targetId: null,
        countsHash,
        createdByMemberId: member.id,
      });
      return c.json(preview('workspace', null, willDelete, token.id, token.expiresAt));
    }

    if (!body.confirmationToken) throw badRequest('confirmationToken is required to commit', 'confirmation_required');
    const idempotencyKey = requireIdempotencyKey(c);
    const replay = await findIdempotentResponse(db, workspace.id, idempotencyKey);
    if (replay !== undefined) return c.json(replay as ResetResult);

    await consumeResetToken(db, {
      workspaceId: workspace.id,
      tokenId: body.confirmationToken,
      scope: 'workspace',
      targetId: null,
    });
    const ctx: PerformContext = {
      workspaceId: workspace.id,
      actorMemberId: member.id,
      apiKeyId: apiKey?.id ?? null,
      tokenId: body.confirmationToken,
      idempotencyKey,
    };
    const counts = await performWorkspaceClear(db, workspace.id, ctx);
    const out = result('workspace', null, counts);
    await storeIdempotentResponse(db, workspace.id, idempotencyKey, 'workspaces/current/reset', out);
    return c.json(out);
  });

  // ---- POST /workspaces/current/seed-demo ------------------------------------
  r.post('/workspaces/current/seed-demo', async (c) => {
    gate(c);
    const { workspace, member, apiKey } = c.get('auth');
    const body = parse(resetBodySchema, await c.req.json().catch(() => ({})));

    // Dry-run reports what the demo WILL create (a fixed canned set), and issues
    // a token. The countsHash binds the current (pre-seed) counts so a racing
    // mutation between dry-run and commit is still detected.
    if (!body.confirm) {
      const { countsHash } = await computeResetPreview(db, workspace.id, 'demo', null);
      const token = await issueResetToken(db, {
        workspaceId: workspace.id,
        scope: 'demo',
        targetId: null,
        countsHash,
        createdByMemberId: member.id,
      });
      // The "counts" here describe what seedDemo will materialize, not a delete.
      return c.json(preview('demo', null, DEMO_PREVIEW_COUNTS, token.id, token.expiresAt));
    }

    if (!body.confirmationToken) throw badRequest('confirmationToken is required to commit', 'confirmation_required');
    const idempotencyKey = requireIdempotencyKey(c);
    const replay = await findIdempotentResponse(db, workspace.id, idempotencyKey);
    if (replay !== undefined) return c.json(replay as ResetResult);

    await consumeResetToken(db, {
      workspaceId: workspace.id,
      tokenId: body.confirmationToken,
      scope: 'demo',
      targetId: null,
    });
    const ctx: PerformContext = {
      workspaceId: workspace.id,
      actorMemberId: member.id,
      apiKeyId: apiKey?.id ?? null,
      tokenId: body.confirmationToken,
      idempotencyKey,
    };
    const counts = await seedDemo(db, workspace.id, { force: body.force }, ctx);
    const out = result('demo', null, counts);
    await storeIdempotentResponse(db, workspace.id, idempotencyKey, 'workspaces/current/seed-demo', out);
    return c.json(out);
  });

  return r;
}

/** Advisory preview of what seed-demo creates (must match services/reset.ts). */
const DEMO_PREVIEW_COUNTS: Record<string, number> = {
  projects: 1,
  tasks: 8,
  dependencies: 2,
  goals: 1,
};

/** Pull the required Idempotency-Key header; 400 when absent on a commit. */
function requireIdempotencyKey(c: Context<AppEnv>): string {
  const key = c.req.header('idempotency-key');
  if (!key || key.trim() === '') {
    throw badRequest('an Idempotency-Key header is required to commit a reset', 'idempotency_key_required');
  }
  return key.trim();
}
