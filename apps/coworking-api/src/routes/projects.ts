import { randomUUID } from 'node:crypto';

import { and, count, eq, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  ACCEPTANCE_CRITERION_KINDS,
  TASK_TYPES,
} from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { activities, labels, projects, statusColumns, taskTemplates } from '../db/schema.js';
import { requireRole } from '../lib/authz.js';
import type { AppEnv } from '../lib/context.js';
import { conflict, forbidden, isUniqueViolation, notFound, parse, paymentRequired } from '../lib/errors.js';
import { LIMITS } from '../lib/limits.js';
import { loadProjectScoped } from '../lib/loaders.js';
import { serializeLabel, serializeProject, serializeStatusColumn, serializeTaskTemplate } from '../lib/serialize.js';
import { authMiddleware } from '../middleware/auth.js';

/** Default board mirrors Linear's opinionated flow; categories drive coordination queries. */
const DEFAULT_COLUMNS = [
  { key: 'backlog', name: 'Backlog', category: 'backlog' },
  { key: 'todo', name: 'To Do', category: 'unstarted' },
  { key: 'in_progress', name: 'In Progress', category: 'started' },
  { key: 'in_review', name: 'In Review', category: 'started' },
  { key: 'done', name: 'Done', category: 'completed' },
  { key: 'canceled', name: 'Canceled', category: 'canceled' },
] as const;

export function projectRoutes(db: Database): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('*', authMiddleware(db));

  const loadProject = (id: string, workspaceId: string) => loadProjectScoped(db, id, workspaceId);

  const createSchema = z.object({
    key: z
      .string()
      .min(1)
      .max(20)
      .regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().min(1).max(160),
    description: z.string().max(4000).optional(),
    linkedBountyId: z
      .string()
      .regex(/^\d+$/)
      .optional(),
  });

  r.post('/projects', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const body = parse(createSchema, await c.req.json().catch(() => ({})));

    if (LIMITS.enforce && !workspace.isPremium) {
      const rows = await db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.workspaceId, workspace.id));
      if ((rows[0]?.value ?? 0) >= LIMITS.freeMaxProjects) {
        throw paymentRequired(
          `Free workspaces are limited to ${LIMITS.freeMaxProjects} projects. Upgrade to Premium for unlimited projects.`,
        );
      }
    }

    const project = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(projects)
        .values({
          workspaceId: workspace.id,
          key: body.key,
          name: body.name,
          description: body.description ?? null,
          linkedBountyId: body.linkedBountyId ? BigInt(body.linkedBountyId) : null,
          createdByMemberId: member.id,
        })
        .returning()
        .catch((err: unknown) => {
          if (isUniqueViolation(err)) {
            throw conflict(`project key "${body.key}" already exists`, 'project_key_taken');
          }
          throw err;
        });
      const proj = inserted[0]!;
      await tx.insert(statusColumns).values(
        DEFAULT_COLUMNS.map((col, i) => ({
          projectId: proj.id,
          key: col.key,
          name: col.name,
          category: col.category,
          position: i,
        })),
      );
      await tx.insert(activities).values({
        workspaceId: workspace.id,
        projectId: proj.id,
        actorMemberId: member.id,
        verb: 'project.created',
        payload: { key: proj.key, name: proj.name },
      });
      return proj;
    });

    return c.json(serializeProject(project), 201);
  });

  r.get('/projects', async (c) => {
    const { workspace } = c.get('auth');
    // Exclude trashed projects always; exclude archived unless ?includeArchived=1.
    const includeArchived = c.req.query('includeArchived') === '1';
    const conds = [eq(projects.workspaceId, workspace.id), isNull(projects.trashedAt)];
    if (!includeArchived) conds.push(sql`${projects.status} <> 'archived'`);
    const rows = await db
      .select()
      .from(projects)
      .where(and(...conds));
    return c.json({ items: rows.map(serializeProject) });
  });

  r.get('/projects/:id', async (c) => {
    const { workspace } = c.get('auth');
    return c.json(serializeProject(await loadProject(c.req.param('id'), workspace.id)));
  });

  const patchSchema = z.object({
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(4000).nullable().optional(),
    status: z.enum(['planning', 'active', 'paused', 'completed', 'archived']).optional(),
  });

  r.patch('/projects/:id', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const project = await loadProject(c.req.param('id'), workspace.id);
    const body = parse(patchSchema, await c.req.json().catch(() => ({})));
    const updated = (
      await db
        .update(projects)
        .set({
          updatedAt: new Date(),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        })
        .where(eq(projects.id, project.id))
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: project.id,
      actorMemberId: member.id,
      verb: 'project.updated',
      payload: { fields: Object.keys(body) },
    });
    return c.json(serializeProject(updated));
  });

  r.get('/projects/:id/columns', async (c) => {
    const { workspace } = c.get('auth');
    const project = await loadProject(c.req.param('id'), workspace.id);
    const rows = await db
      .select()
      .from(statusColumns)
      .where(eq(statusColumns.projectId, project.id))
      .orderBy(statusColumns.position);
    return c.json({ items: rows.map(serializeStatusColumn) });
  });

  const columnSchema = z.object({
    key: z.string().min(1).max(40),
    name: z.string().min(1).max(80),
    category: z.enum(['backlog', 'unstarted', 'started', 'completed', 'canceled']).optional(),
    position: z.number().int().min(0).optional(),
  });

  r.post('/projects/:id/columns', async (c) => {
    // Managing board columns is an admin action.
    requireRole(c, 'admin');
    const { workspace } = c.get('auth');
    const project = await loadProject(c.req.param('id'), workspace.id);
    const body = parse(columnSchema, await c.req.json().catch(() => ({})));
    try {
      const column = (
        await db
          .insert(statusColumns)
          .values({
            projectId: project.id,
            key: body.key,
            name: body.name,
            category: body.category ?? 'unstarted',
            position: body.position ?? 0,
          })
          .returning()
      )[0]!;
      return c.json(serializeStatusColumn(column), 201);
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('a column with that key already exists');
      throw err;
    }
  });

  // ---- Labels (project-scoped) -----------------------------------------------

  r.get('/projects/:id/labels', async (c) => {
    const { workspace } = c.get('auth');
    const project = await loadProject(c.req.param('id'), workspace.id);
    const rows = await db
      .select()
      .from(labels)
      .where(eq(labels.projectId, project.id))
      .orderBy(labels.name);
    return c.json({ items: rows.map(serializeLabel) });
  });

  const labelSchema = z.object({
    name: z.string().min(1).max(80),
    color: z.string().max(40).optional(),
  });

  r.post('/projects/:id/labels', async (c) => {
    requireRole(c, 'member');
    const { workspace } = c.get('auth');
    const project = await loadProject(c.req.param('id'), workspace.id);
    const body = parse(labelSchema, await c.req.json().catch(() => ({})));
    try {
      const label = (
        await db
          .insert(labels)
          .values({ projectId: project.id, name: body.name, color: body.color ?? null })
          .returning()
      )[0]!;
      return c.json(serializeLabel(label), 201);
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('a label with that name already exists', 'label_name_taken');
      throw err;
    }
  });

  // ---- Task templates (workspace-wide + project-scoped) ----------------------

  // AC items on a template are authored as { kind?, text } and materialized into
  // fresh criteria when a task is instantiated; ids/done are server-managed.
  const templateAcInput = z.object({
    kind: z.enum(ACCEPTANCE_CRITERION_KINDS).optional(),
    text: z.string().min(1).max(2000),
  });

  const templateCreateSchema = z.object({
    name: z.string().min(1).max(160),
    taskType: z.enum(TASK_TYPES).optional(),
    // When set, the template is scoped to a single project (must be in-workspace).
    projectId: z.string().optional(),
    descriptionMarkdown: z.string().max(20000).optional(),
    acceptanceCriteria: z.array(templateAcInput).optional(),
    defaultPriority: z.number().int().min(0).max(4).optional(),
    defaultLabels: z.array(z.string()).optional(),
    defaultEstimateMinutes: z.number().int().min(0).optional(),
    fieldDefaults: z.record(z.string(), z.unknown()).optional(),
    requiredFields: z.array(z.string()).optional(),
  });

  const materializeTemplateAc = (items: z.infer<typeof templateAcInput>[]) =>
    items.map((it) => ({
      id: randomUUID(),
      kind: it.kind ?? ('rule' as const),
      text: it.text,
      done: false,
    }));

  const loadTemplate = async (id: string, workspaceId: string) => {
    const rows = await db
      .select()
      .from(taskTemplates)
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.workspaceId, workspaceId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound('template not found');
    return row;
  };

  // List workspace-wide templates plus, when ?projectId is given, that project's
  // own templates. Without a filter, returns workspace-wide templates only.
  r.get('/templates', async (c) => {
    const { workspace } = c.get('auth');
    const projectId = c.req.query('projectId');
    const scope = projectId
      ? or(isNull(taskTemplates.projectId), eq(taskTemplates.projectId, projectId))
      : isNull(taskTemplates.projectId);
    const rows = await db
      .select()
      .from(taskTemplates)
      .where(and(eq(taskTemplates.workspaceId, workspace.id), scope))
      .orderBy(taskTemplates.name);
    return c.json({ items: rows.map(serializeTaskTemplate) });
  });

  r.get('/templates/:id', async (c) => {
    const { workspace } = c.get('auth');
    return c.json(serializeTaskTemplate(await loadTemplate(c.req.param('id'), workspace.id)));
  });

  r.post('/templates', async (c) => {
    requireRole(c, 'member');
    const { workspace, member } = c.get('auth');
    const body = parse(templateCreateSchema, await c.req.json().catch(() => ({})));
    if (body.projectId) await loadProject(body.projectId, workspace.id);
    const created = (
      await db
        .insert(taskTemplates)
        .values({
          workspaceId: workspace.id,
          projectId: body.projectId ?? null,
          name: body.name,
          taskType: body.taskType ?? 'generic',
          descriptionMarkdown: body.descriptionMarkdown ?? null,
          acceptanceCriteria: materializeTemplateAc(body.acceptanceCriteria ?? []),
          defaultPriority: body.defaultPriority ?? null,
          defaultLabels: body.defaultLabels ?? null,
          defaultEstimateMinutes: body.defaultEstimateMinutes ?? null,
          fieldDefaults: body.fieldDefaults ?? null,
          requiredFields: body.requiredFields ?? null,
          builtin: false,
        })
        .returning()
    )[0]!;
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: created.projectId,
      actorMemberId: member.id,
      verb: 'template.created',
      payload: { templateId: created.id, name: created.name, taskType: created.taskType },
    });
    return c.json(serializeTaskTemplate(created), 201);
  });

  const templatePatchSchema = z.object({
    name: z.string().min(1).max(160).optional(),
    taskType: z.enum(TASK_TYPES).optional(),
    descriptionMarkdown: z.string().max(20000).nullable().optional(),
    acceptanceCriteria: z.array(templateAcInput).optional(),
    defaultPriority: z.number().int().min(0).max(4).nullable().optional(),
    defaultLabels: z.array(z.string()).nullable().optional(),
    defaultEstimateMinutes: z.number().int().min(0).nullable().optional(),
    fieldDefaults: z.record(z.string(), z.unknown()).nullable().optional(),
    requiredFields: z.array(z.string()).nullable().optional(),
  });

  r.patch('/templates/:id', async (c) => {
    requireRole(c, 'member');
    const { workspace } = c.get('auth');
    const template = await loadTemplate(c.req.param('id'), workspace.id);
    if (template.builtin) throw forbidden('builtin templates cannot be edited');
    const body = parse(templatePatchSchema, await c.req.json().catch(() => ({})));
    const updated = (
      await db
        .update(taskTemplates)
        .set({
          updatedAt: new Date(),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.taskType !== undefined ? { taskType: body.taskType } : {}),
          ...(body.descriptionMarkdown !== undefined
            ? { descriptionMarkdown: body.descriptionMarkdown }
            : {}),
          ...(body.acceptanceCriteria !== undefined
            ? { acceptanceCriteria: materializeTemplateAc(body.acceptanceCriteria) }
            : {}),
          ...(body.defaultPriority !== undefined ? { defaultPriority: body.defaultPriority } : {}),
          ...(body.defaultLabels !== undefined ? { defaultLabels: body.defaultLabels } : {}),
          ...(body.defaultEstimateMinutes !== undefined
            ? { defaultEstimateMinutes: body.defaultEstimateMinutes }
            : {}),
          ...(body.fieldDefaults !== undefined ? { fieldDefaults: body.fieldDefaults } : {}),
          ...(body.requiredFields !== undefined ? { requiredFields: body.requiredFields } : {}),
        })
        .where(eq(taskTemplates.id, template.id))
        .returning()
    )[0]!;
    return c.json(serializeTaskTemplate(updated));
  });

  r.delete('/templates/:id', async (c) => {
    requireRole(c, 'member');
    const { workspace } = c.get('auth');
    const template = await loadTemplate(c.req.param('id'), workspace.id);
    if (template.builtin) throw forbidden('builtin templates cannot be deleted');
    await db.delete(taskTemplates).where(eq(taskTemplates.id, template.id));
    return c.json({ ok: true });
  });

  return r;
}
