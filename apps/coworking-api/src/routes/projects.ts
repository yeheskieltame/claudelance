import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import { activities, projects, statusColumns } from '../db/schema.js';
import type { AppEnv } from '../lib/context.js';
import { conflict, isUniqueViolation, notFound, parse } from '../lib/errors.js';
import { loadProjectScoped } from '../lib/loaders.js';
import { serializeProject, serializeStatusColumn } from '../lib/serialize.js';
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
    const { workspace, member } = c.get('auth');
    const body = parse(createSchema, await c.req.json().catch(() => ({})));

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
    const rows = await db.select().from(projects).where(eq(projects.workspaceId, workspace.id));
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

  return r;
}
