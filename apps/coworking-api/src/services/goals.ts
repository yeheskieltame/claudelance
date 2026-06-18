// Goal progress roll-up. A goal with links derives progress from the completion
// of the linked tasks/projects (weighted); a goal without links falls back to
// currentValue / targetValue.

import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { goalLinks, goals, statusColumns, tasks } from '../db/schema.js';

async function isTaskCompleted(db: Database, taskId: string): Promise<boolean> {
  const rows = await db
    .select({ category: statusColumns.category })
    .from(tasks)
    .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return rows[0]?.category === 'completed';
}

async function projectCompletionFraction(db: Database, projectId: string): Promise<number> {
  const rows = await db
    .select({ category: statusColumns.category })
    .from(tasks)
    .innerJoin(statusColumns, eq(tasks.statusColumnId, statusColumns.id))
    .where(eq(tasks.projectId, projectId));
  if (rows.length === 0) return 0;
  const done = rows.filter((r) => r.category === 'completed').length;
  return done / rows.length;
}

/** Returns a completion fraction in [0, 1]. */
export async function computeGoalProgress(db: Database, goalId: string): Promise<number> {
  const links = await db.select().from(goalLinks).where(eq(goalLinks.goalId, goalId));

  if (links.length === 0) {
    const goal = (await db.select().from(goals).where(eq(goals.id, goalId)).limit(1))[0];
    if (goal && goal.targetValue !== null && goal.targetValue > 0) {
      return Math.min(1, goal.currentValue / goal.targetValue);
    }
    return 0;
  }

  let weighted = 0;
  let total = 0;
  for (const link of links) {
    total += link.weight;
    if (link.taskId) {
      weighted += link.weight * ((await isTaskCompleted(db, link.taskId)) ? 1 : 0);
    } else if (link.projectId) {
      weighted += link.weight * (await projectCompletionFraction(db, link.projectId));
    }
  }
  return total > 0 ? weighted / total : 0;
}
