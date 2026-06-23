import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { TASK_TYPES } from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { automations, projects } from '../db/schema.js';
import { requireRole, requireScope } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { notFound, parse } from '../lib/errors.js';
import { loadProjectScoped } from '../lib/loaders.js';
import { serializeAutomation } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

const triggerSchema = z.object({
  event: z.enum(['task.created', 'task.status_changed']),
  to: z.string().optional(),
  // Optional: scope the rule to a single task type.
  taskType: z.enum(TASK_TYPES).optional(),
});

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_comment'), body: z.string().min(1).max(20000) }),
  z.object({
    type: z.literal('create_task'),
    title: z.string().min(1).max(300),
    statusColumnKey: z.string().optional(),
  }),
  // Non-blocking AC/DoD warn: posts a comment when unmet items remain.
  z.object({ type: z.literal('warn_if_incomplete'), body: z.string().min(1).max(20000).optional() }),
]);

/** If-this-then-that rules per project, evaluated by the automation engine. */
export function automationRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  const loadAutomation = async (id: string, workspaceId: string) => {
    const rows = await db
      .select({ automation: automations })
      .from(automations)
      .innerJoin(projects, eq(automations.projectId, projects.id))
      .where(and(eq(automations.id, id), eq(projects.workspaceId, workspaceId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound('automation not found');
    return row.automation;
  };

  const createSchema = z.object({
    name: z.string().min(1).max(120),
    trigger: triggerSchema,
    action: actionSchema,
    enabled: z.boolean().optional(),
  });

  r.post('/projects/:id/automations', async (c) => {
    requireRole(c, 'admin');
    requireScope(c, 'admin');
    const { workspace } = c.get('auth');
    const project = await loadProjectScoped(db, c.req.param('id'), workspace.id);
    const body = parse(createSchema, await c.req.json().catch(() => ({})));
    const automation = (
      await db
        .insert(automations)
        .values({
          projectId: project.id,
          name: body.name,
          trigger: body.trigger,
          action: body.action,
          enabled: body.enabled ?? true,
        })
        .returning()
    )[0]!;
    return c.json(serializeAutomation(automation), 201);
  });

  r.get('/projects/:id/automations', async (c) => {
    const { workspace } = c.get('auth');
    const project = await loadProjectScoped(db, c.req.param('id'), workspace.id);
    const rows = await db.select().from(automations).where(eq(automations.projectId, project.id));
    return c.json({ items: rows.map(serializeAutomation) });
  });

  const patchSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    trigger: triggerSchema.optional(),
    action: actionSchema.optional(),
    enabled: z.boolean().optional(),
  });

  r.patch('/automations/:id', async (c) => {
    requireRole(c, 'admin');
    requireScope(c, 'admin');
    const { workspace } = c.get('auth');
    const automation = await loadAutomation(c.req.param('id'), workspace.id);
    const body = parse(patchSchema, await c.req.json().catch(() => ({})));
    const updated = (
      await db
        .update(automations)
        .set({
          updatedAt: new Date(),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.trigger !== undefined ? { trigger: body.trigger } : {}),
          ...(body.action !== undefined ? { action: body.action } : {}),
          ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        })
        .where(eq(automations.id, automation.id))
        .returning()
    )[0]!;
    return c.json(serializeAutomation(updated));
  });

  r.delete('/automations/:id', async (c) => {
    requireRole(c, 'admin');
    requireScope(c, 'admin');
    const { workspace } = c.get('auth');
    const automation = await loadAutomation(c.req.param('id'), workspace.id);
    await db.delete(automations).where(eq(automations.id, automation.id));
    return c.json({ ok: true });
  });

  return r;
}
