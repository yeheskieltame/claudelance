// Coordination queries - the agent-facing "what should I do?" layer that sets
// Coworking apart from plain CRUD. A blocker is "satisfied" once its column is
// completed or canceled; until then it blocks its dependents.

import { and, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Task, TaskType } from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { projects, statusColumns, taskDependencies, tasks } from '../db/schema.js';
import { serializeTask } from '../lib/serialize.js';

const SATISFIED = ['completed', 'canceled'];
const ACTIONABLE = ['backlog', 'unstarted'];
// A task is "awaiting review" while it sits in an in-progress column - either an
// explicit review column or any started column the assignee pushed it to.
const AWAITING_REVIEW = ['started'];

// Urgent (1) first ... low (4), then none (0) last; ties broken by age.
const priorityOrder = sql`case when ${tasks.priority} = 0 then 5 else ${tasks.priority} end`;

/** A member's assigned tasks that are not yet done or canceled. */
export async function myOpenTasks(
  db: Database,
  workspaceId: string,
  memberId: string,
  type?: TaskType,
): Promise<Task[]> {
  const conds = [
    eq(projects.workspaceId, workspaceId),
    isNull(projects.trashedAt),
    sql`${projects.status} <> 'archived'`,
    eq(tasks.assigneeMemberId, memberId),
    isNull(tasks.trashedAt),
    notInArray(statusColumns.category, SATISFIED),
  ];
  if (type) conds.push(eq(tasks.type, type));
  const rows = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
    .where(and(...conds))
    .orderBy(priorityOrder, tasks.createdAt);
  return rows.map((r) => serializeTask(r.task));
}

export interface BlockedTask {
  task: Task;
  blockers: Task[];
}

/** A member's open tasks that are blocked by at least one unfinished blocker. */
export async function whatsBlockingMe(
  db: Database,
  workspaceId: string,
  memberId: string,
  type?: TaskType,
): Promise<BlockedTask[]> {
  const blocker = alias(tasks, 'blocker');
  const blockerCol = alias(statusColumns, 'blocker_col');
  const conds = [
    eq(projects.workspaceId, workspaceId),
    isNull(projects.trashedAt),
    sql`${projects.status} <> 'archived'`,
    eq(tasks.assigneeMemberId, memberId),
    isNull(tasks.trashedAt),
    notInArray(statusColumns.category, SATISFIED),
    notInArray(blockerCol.category, SATISFIED),
  ];
  if (type) conds.push(eq(tasks.type, type));
  const rows = await db
    .select({ task: tasks, blocker })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
    .innerJoin(
      taskDependencies,
      and(eq(taskDependencies.blockedTaskId, tasks.id), eq(taskDependencies.type, 'blocks')),
    )
    .innerJoin(blocker, eq(blocker.id, taskDependencies.blockerTaskId))
    .innerJoin(blockerCol, eq(blocker.statusColumnId, blockerCol.id))
    .where(and(...conds));

  const grouped = new Map<string, BlockedTask>();
  for (const row of rows) {
    const entry = grouped.get(row.task.id) ?? { task: serializeTask(row.task), blockers: [] };
    entry.blockers.push(serializeTask(row.blocker));
    grouped.set(row.task.id, entry);
  }
  return [...grouped.values()];
}

/**
 * Tasks in a project that are ready to start now: in backlog/unstarted,
 * unassigned or assigned to the caller, and not blocked by any unfinished task.
 * Ordered by priority.
 */
export async function whatsNext(
  db: Database,
  projectId: string,
  memberId: string,
  type?: TaskType,
): Promise<Task[]> {
  const candidateConds = [
    eq(tasks.projectId, projectId),
    isNull(tasks.trashedAt),
    inArray(statusColumns.category, ACTIONABLE),
    or(isNull(tasks.assigneeMemberId), eq(tasks.assigneeMemberId, memberId)),
  ];
  if (type) candidateConds.push(eq(tasks.type, type));
  const candidates = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
    .where(and(...candidateConds))
    .orderBy(priorityOrder, tasks.createdAt);

  const blocker = alias(tasks, 'blocker');
  const blockerCol = alias(statusColumns, 'blocker_col');
  const blockedRows = await db
    .selectDistinct({ id: tasks.id })
    .from(tasks)
    .innerJoin(
      taskDependencies,
      and(eq(taskDependencies.blockedTaskId, tasks.id), eq(taskDependencies.type, 'blocks')),
    )
    .innerJoin(blocker, eq(blocker.id, taskDependencies.blockerTaskId))
    .innerJoin(blockerCol, eq(blocker.statusColumnId, blockerCol.id))
    .where(
      and(
        eq(tasks.projectId, projectId),
        // A trashed blocker no longer blocks its dependents.
        isNull(blocker.trashedAt),
        notInArray(blockerCol.category, SATISFIED),
      ),
    );

  const blocked = new Set(blockedRows.map((r) => r.id));
  return candidates.filter((r) => !blocked.has(r.task.id)).map((r) => serializeTask(r.task));
}

/**
 * Tasks for which the caller is the accountable reviewer and that are currently
 * in an in-progress / review column (category `started`), not trashed. This is
 * the reviewer-side inbox - the counterpart to {@link myOpenTasks} for the
 * RACI "Accountable" role.
 */
export async function awaitingMyReview(
  db: Database,
  workspaceId: string,
  memberId: string,
  type?: TaskType,
): Promise<Task[]> {
  const conds = [
    eq(projects.workspaceId, workspaceId),
    isNull(projects.trashedAt),
    sql`${projects.status} <> 'archived'`,
    eq(tasks.reviewerMemberId, memberId),
    isNull(tasks.trashedAt),
    inArray(statusColumns.category, AWAITING_REVIEW),
  ];
  if (type) conds.push(eq(tasks.type, type));
  const rows = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
    .where(and(...conds))
    .orderBy(priorityOrder, tasks.createdAt);
  return rows.map((r) => serializeTask(r.task));
}
