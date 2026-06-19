import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { DoDItem } from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { activities, apiKeys, members, workspaces } from '../db/schema.js';
import { generateApiKey } from '../lib/apikey.js';
import { requireRole } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { conflict, isUniqueViolation, notFound, parse } from '../lib/errors.js';
import {
  serializeApiKeyInfo,
  serializeApiKeyWithSecret,
  serializeMember,
  serializeWorkspace,
} from '../lib/serialize.js';
import { slugify, uniqueWorkspaceSlug } from '../lib/slug.js';
import { authMiddleware } from '../middleware/auth.js';
import { seedBuiltinTemplates } from '../services/templates.js';

/** Public bootstrap route - no API key required. */
export function publicWorkspaceRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  const schema = z.object({
    name: z.string().min(1).max(120),
    slug: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    ownerAddress: z.string().min(1).max(100).optional(),
    ownerName: z.string().min(1).max(120).optional(),
  });

  r.post('/workspaces', async (c) => {
    const body = parse(schema, await c.req.json().catch(() => ({})));
    const slug = await uniqueWorkspaceSlug(db, body.slug ?? slugify(body.name));
    const ownerAddress = body.ownerAddress?.toLowerCase() ?? null;

    const result = await db.transaction(async (tx) => {
      const workspace = (
        await tx.insert(workspaces).values({ slug, name: body.name, ownerAddress }).returning()
      )[0]!;
      const member = (
        await tx
          .insert(members)
          .values({
            workspaceId: workspace.id,
            kind: ownerAddress ? 'agent' : 'human',
            displayName: body.ownerName ?? 'Owner',
            address: ownerAddress,
            role: 'owner',
          })
          .returning()
      )[0]!;
      const secret = generateApiKey();
      const apiKey = (
        await tx
          .insert(apiKeys)
          .values({
            workspaceId: workspace.id,
            memberId: member.id,
            name: 'owner',
            prefix: secret.prefix,
            keyHash: secret.keyHash,
            scopes: ['read', 'write', 'admin'],
          })
          .returning()
      )[0]!;
      await tx.insert(activities).values({
        workspaceId: workspace.id,
        actorMemberId: member.id,
        verb: 'workspace.created',
        payload: { slug },
      });
      // Seed the builtin task templates alongside the owner + default board.
      await seedBuiltinTemplates(tx as unknown as Database, workspace.id);
      return { workspace, apiKey, key: secret.key };
    });

    return c.json(
      {
        workspace: serializeWorkspace(result.workspace),
        owner: serializeMember(
          (await db.select().from(members).where(eq(members.id, result.apiKey.memberId)).limit(1))[0]!,
        ),
        apiKey: serializeApiKeyWithSecret(result.apiKey, result.key),
      },
      201,
    );
  });

  return r;
}

/** Authed workspace administration: current workspace, members, API keys. */
export function workspaceRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  r.get('/workspace', (c) => c.json(serializeWorkspace(c.get('auth').workspace)));

  // The authenticated caller's own member record. Returns ONLY the caller (from
  // the auth context resolved by the API key) - never other members, never the
  // api-key secret.
  r.get('/me', (c) => c.json(serializeMember(c.get('auth').member)));

  const dodItemInput = z.object({
    id: z.string().optional(),
    text: z.string().min(1).max(2000),
    done: z.boolean().optional(),
  });

  const workspacePatchSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    allowReset: z.boolean().optional(),
    definitionOfDone: z.array(dodItemInput).optional(),
  });

  // Owner-only workspace settings: rename, toggle reset, set the DoD template.
  r.patch('/workspace', async (c) => {
    requireRole(c, 'owner');
    const { workspace, member } = c.get('auth');
    const body = parse(workspacePatchSchema, await c.req.json().catch(() => ({})));
    const dod: DoDItem[] | undefined = body.definitionOfDone
      ? body.definitionOfDone.map((d) => ({ id: d.id ?? randomUUID(), text: d.text, done: d.done ?? false }))
      : undefined;
    const updated = (
      await db
        .update(workspaces)
        .set({
          updatedAt: new Date(),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.allowReset !== undefined ? { allowReset: body.allowReset } : {}),
          ...(dod !== undefined ? { definitionOfDone: dod } : {}),
        })
        .where(eq(workspaces.id, workspace.id))
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      actorMemberId: member.id,
      verb: 'workspace.updated',
      payload: { fields: Object.keys(body) },
    });
    return c.json(serializeWorkspace(updated));
  });

  r.get('/members', async (c) => {
    const { workspace } = c.get('auth');
    const rows = await db.select().from(members).where(eq(members.workspaceId, workspace.id));
    return c.json({ items: rows.map(serializeMember) });
  });

  const memberSchema = z.object({
    displayName: z.string().min(1).max(120),
    kind: z.enum(['human', 'agent']).optional(),
    address: z.string().min(1).max(100).optional(),
    agentId: z
      .string()
      .regex(/^\d+$/)
      .optional(),
    email: z.string().email().optional(),
    role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  });

  r.post('/members', async (c) => {
    requireRole(c, 'admin');
    const { workspace, member } = c.get('auth');
    const body = parse(memberSchema, await c.req.json().catch(() => ({})));
    try {
      const created = (
        await db
          .insert(members)
          .values({
            workspaceId: workspace.id,
            kind: body.kind ?? (body.address ? 'agent' : 'human'),
            displayName: body.displayName,
            address: body.address?.toLowerCase() ?? null,
            agentId: body.agentId ? BigInt(body.agentId) : null,
            email: body.email ?? null,
            role: body.role ?? 'member',
          })
          .returning()
      )[0]!;
      await db.insert(activities).values({
        workspaceId: workspace.id,
        actorMemberId: member.id,
        verb: 'member.joined',
        payload: { memberId: created.id, displayName: created.displayName },
      });
      return c.json(serializeMember(created), 201);
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('a member with that address already exists');
      throw err;
    }
  });

  r.get('/keys', async (c) => {
    const { workspace } = c.get('auth');
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.workspaceId, workspace.id));
    return c.json({ items: rows.map(serializeApiKeyInfo) });
  });

  const keySchema = z.object({
    memberId: z.string().min(1),
    name: z.string().min(1).max(80).optional(),
    scopes: z.array(z.string()).optional(),
  });

  r.post('/keys', async (c) => {
    requireRole(c, 'admin');
    const { workspace } = c.get('auth');
    const body = parse(keySchema, await c.req.json().catch(() => ({})));
    const target = (
      await db
        .select()
        .from(members)
        .where(and(eq(members.id, body.memberId), eq(members.workspaceId, workspace.id)))
        .limit(1)
    )[0];
    if (!target) throw notFound('member not found');

    const secret = generateApiKey();
    const apiKey = (
      await db
        .insert(apiKeys)
        .values({
          workspaceId: workspace.id,
          memberId: target.id,
          name: body.name ?? 'default',
          prefix: secret.prefix,
          keyHash: secret.keyHash,
          scopes: body.scopes ?? ['read', 'write'],
        })
        .returning()
    )[0]!;
    return c.json(serializeApiKeyWithSecret(apiKey, secret.key), 201);
  });

  r.delete('/keys/:id', async (c) => {
    requireRole(c, 'admin');
    const { workspace } = c.get('auth');
    const revoked = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, c.req.param('id')), eq(apiKeys.workspaceId, workspace.id)))
      .returning();
    if (revoked.length === 0) throw notFound('api key not found');
    return c.json({ ok: true });
  });

  return r;
}
