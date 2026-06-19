// Automation rule engine. Invoked synchronously from the task routes after a
// task is created or moves columns. Engine actions run directly against the db
// and do NOT re-enter the engine, so rules cannot cascade into infinite loops.

import { and, eq, max, type InferSelectModel } from 'drizzle-orm';

import type { AcceptanceCriterion, DoDItem } from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { activities, automations, comments, statusColumns, tasks } from '../db/schema.js';

export interface AutomationContext {
  event: 'task.created' | 'task.status_changed';
  task: InferSelectModel<typeof tasks>;
  workspaceId: string;
  actorMemberId: string | null;
  /** Column key the task moved into (for task.status_changed). */
  toColumnKey?: string;
}

interface ActionSpec {
  type?: string;
  body?: string;
  title?: string;
  statusColumnKey?: string;
}

export async function runAutomations(db: Database, ctx: AutomationContext): Promise<void> {
  const rules = await db
    .select()
    .from(automations)
    .where(and(eq(automations.projectId, ctx.task.projectId), eq(automations.enabled, true)));

  for (const rule of rules) {
    const trigger = (rule.trigger ?? {}) as { event?: string; to?: string; taskType?: string };
    if (trigger.event !== ctx.event) continue;
    if (ctx.event === 'task.status_changed' && trigger.to && trigger.to !== ctx.toColumnKey) continue;
    // Optional task-type matcher: a rule may scope itself to one task type.
    if (trigger.taskType && trigger.taskType !== ctx.task.type) continue;
    await executeAction(db, rule.id, rule.name, (rule.action ?? {}) as ActionSpec, ctx);
  }
}

async function executeAction(
  db: Database,
  automationId: string,
  name: string,
  action: ActionSpec,
  ctx: AutomationContext,
): Promise<void> {
  if (action.type === 'add_comment' && action.body) {
    await db.insert(comments).values({ taskId: ctx.task.id, authorMemberId: null, body: action.body });
    await recordFired(db, automationId, name, ctx, 'add_comment');
    return;
  }

  // Non-blocking AC/DoD check: post a warning comment when the task still has
  // unmet acceptance-criteria or DoD items. Never blocks, never recurses. The
  // triggering status move has already committed, so this advisory write must
  // never turn a successful move into a 500 - swallow + log any failure.
  if (action.type === 'warn_if_incomplete') {
    const ac = Array.isArray(ctx.task.acceptanceCriteria)
      ? (ctx.task.acceptanceCriteria as AcceptanceCriterion[])
      : [];
    const dod = Array.isArray(ctx.task.definitionOfDone)
      ? (ctx.task.definitionOfDone as DoDItem[])
      : [];
    const unmet = [...ac, ...dod].filter((i) => !i.done);
    if (unmet.length > 0) {
      try {
        await db.insert(comments).values({
          taskId: ctx.task.id,
          authorMemberId: null,
          body:
            action.body ??
            `Automation: this task has ${unmet.length} unmet acceptance/DoD item(s) still open.`,
        });
        await recordFired(db, automationId, name, ctx, 'warn_if_incomplete');
      } catch (err) {
        console.error(
          JSON.stringify({
            message: 'coworking.automation.warn_if_incomplete.failed',
            automationId,
            taskId: ctx.task.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    return;
  }

  if (action.type === 'create_task' && action.title) {
    const cols = await db
      .select()
      .from(statusColumns)
      .where(eq(statusColumns.projectId, ctx.task.projectId))
      .orderBy(statusColumns.position);
    const column = action.statusColumnKey
      ? cols.find((c) => c.key === action.statusColumnKey)
      : cols[0];
    if (!column) return;
    const agg = await db
      .select({ value: max(tasks.number) })
      .from(tasks)
      .where(eq(tasks.projectId, ctx.task.projectId));
    const number = (agg[0]?.value ?? 0) + 1;
    const created = (
      await db
        .insert(tasks)
        .values({
          projectId: ctx.task.projectId,
          number,
          title: action.title,
          statusColumnId: column.id,
          priority: 0,
        })
        .returning()
    )[0]!;
    // Log the creation, but do NOT recurse into runAutomations for it.
    await db.insert(activities).values({
      workspaceId: ctx.workspaceId,
      projectId: ctx.task.projectId,
      taskId: created.id,
      actorMemberId: null,
      verb: 'task.created',
      payload: { number, title: created.title, automated: true },
    });
    await recordFired(db, automationId, name, ctx, 'create_task');
  }
}

async function recordFired(
  db: Database,
  automationId: string,
  name: string,
  ctx: AutomationContext,
  action: string,
): Promise<void> {
  await db.insert(activities).values({
    workspaceId: ctx.workspaceId,
    projectId: ctx.task.projectId,
    taskId: ctx.task.id,
    actorMemberId: null,
    verb: 'automation.fired',
    payload: { automationId, name, action },
  });
}
