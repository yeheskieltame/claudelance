// Shared "load X scoped to the caller's workspace, else 404" helpers, used by
// route handlers and services so scoping logic lives in one place.

import { and, eq, type InferSelectModel } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { goals, projects, tasks } from '../db/schema.js';
import { notFound } from './errors.js';

export async function loadProjectScoped(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<InferSelectModel<typeof projects>> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  const project = rows[0];
  if (!project) throw notFound('project not found');
  return project;
}

export async function loadTaskScoped(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<InferSelectModel<typeof tasks>> {
  const rows = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('task not found');
  return row.task;
}

export async function loadGoalScoped(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<InferSelectModel<typeof goals>> {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.workspaceId, workspaceId)))
    .limit(1);
  const goal = rows[0];
  if (!goal) throw notFound('goal not found');
  return goal;
}
