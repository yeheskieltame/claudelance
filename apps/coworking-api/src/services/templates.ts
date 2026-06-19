// Task templates: reusable scaffolds that pre-fill a new task's type,
// description, acceptance criteria, priority, labels, estimate and per-type
// field defaults. ~15 builtins (one per meaningful task type) are seeded into
// every workspace at bootstrap; workspaces can also author their own. legal and
// finance builtins carry a mandatory disclaimer acceptance-criterion (mirrors
// the on-chain v3 disclaimerRequired flag for bounty types 8/9).

import { randomUUID } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import type {
  AcceptanceCriterion,
  AcceptanceCriterionKind,
  TaskPriority,
  TaskType,
} from '@yeheskieltame/claudelance-coworking-types';

import type { Database } from '../db/client.js';
import { taskTemplates } from '../db/schema.js';

/** A row from the task_templates table (or a builtin spec coerced to one). */
interface TemplateRow {
  taskType: string;
  descriptionMarkdown: string | null;
  acceptanceCriteria: unknown;
  defaultPriority: number | null;
  defaultLabels: string[] | null;
  defaultEstimateMinutes: number | null;
  fieldDefaults: unknown;
  requiredFields: string[] | null;
}

/** Per-task overrides supplied at instantiation time (from the create body). */
export interface TemplateOverrides {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  estimateMinutes?: number | null;
  /** Values substituted into {{placeholder}} tokens in the description. */
  vars?: Record<string, string | number>;
  /** Caller-provided field bag, merged over the template's fieldDefaults. */
  fields?: Record<string, unknown>;
}

/** Materialized task shape produced by rendering a template + overrides. */
export interface RenderedTemplate {
  type: TaskType;
  description: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  priority: TaskPriority | undefined;
  defaultLabels: string[];
  estimateMinutes: number | null | undefined;
  fields: Record<string, unknown> | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Substitute {{key}} tokens; unknown tokens are left intact. */
function renderPlaceholders(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Coerce a template's stored acceptanceCriteria into fresh AcceptanceCriterion[]
 * with new ids and done=false. Accepts items authored either as plain strings,
 * `{ kind?, text }`, or already-shaped criteria; tolerates legacy null/non-array.
 */
function materializeCriteria(stored: unknown): AcceptanceCriterion[] {
  if (!Array.isArray(stored)) return [];
  const out: AcceptanceCriterion[] = [];
  for (const raw of stored) {
    if (typeof raw === 'string') {
      out.push({ id: randomUUID(), kind: 'rule', text: raw, done: false });
      continue;
    }
    if (isRecord(raw) && typeof raw.text === 'string') {
      const kind: AcceptanceCriterionKind = raw.kind === 'scenario' ? 'scenario' : 'rule';
      out.push({
        id: randomUUID(),
        kind,
        text: raw.text,
        done: false,
        ...(typeof raw.verification === 'string' ? { verification: raw.verification } : {}),
      });
    }
  }
  return out;
}

/**
 * Render a template into a concrete task body, applying overrides last. The
 * description has {{placeholders}} substituted from `overrides.vars`. Acceptance
 * criteria are always freshly materialized (done=false, new ids). requiredFields
 * are validated against the merged field bag.
 *
 * @throws Error with a `requiredFields` message when a required field is absent.
 */
export function renderTemplate(template: TemplateRow, overrides: TemplateOverrides = {}): RenderedTemplate {
  const vars = overrides.vars ?? {};
  const baseDescription = template.descriptionMarkdown ?? null;
  const description =
    overrides.description !== undefined
      ? overrides.description
      : baseDescription === null
        ? null
        : renderPlaceholders(baseDescription, vars);

  const mergedFields: Record<string, unknown> = {
    ...(isRecord(template.fieldDefaults) ? template.fieldDefaults : {}),
    ...(overrides.fields ?? {}),
  };

  const required = template.requiredFields ?? [];
  const missing = required.filter(
    (k) => mergedFields[k] === undefined || mergedFields[k] === null || mergedFields[k] === '',
  );
  if (missing.length > 0) {
    throw new Error(`template requires fields: ${missing.join(', ')}`);
  }

  const priority =
    overrides.priority !== undefined
      ? overrides.priority
      : template.defaultPriority === null
        ? undefined
        : (template.defaultPriority as TaskPriority);

  return {
    type: (template.taskType as TaskType) ?? 'generic',
    description,
    acceptanceCriteria: materializeCriteria(template.acceptanceCriteria),
    priority,
    defaultLabels: template.defaultLabels ?? [],
    estimateMinutes:
      overrides.estimateMinutes !== undefined
        ? overrides.estimateMinutes
        : template.defaultEstimateMinutes,
    fields: Object.keys(mergedFields).length > 0 ? mergedFields : null,
  };
}

/** Authoring shape for a builtin template (AC as {kind,text} specs). */
interface BuiltinSpec {
  name: string;
  taskType: TaskType;
  descriptionMarkdown: string;
  acceptanceCriteria: Array<{ kind: AcceptanceCriterionKind; text: string }>;
  defaultPriority?: TaskPriority;
  defaultLabels?: string[];
  defaultEstimateMinutes?: number;
  requiredFields?: string[];
}

// Mandatory disclaimer criterion shared by legal + finance (advisory, not legal advice).
const DISCLAIMER = {
  kind: 'rule' as const,
  text: 'Output includes a clear disclaimer that this is AI-generated assistance, not professional legal/financial advice, and a qualified professional should be consulted.',
};

/**
 * The ~15 builtin templates: one per meaningful task type (generic is omitted -
 * it is the default). legal & finance prepend the mandatory disclaimer AC item.
 */
const BUILTIN_TEMPLATES: BuiltinSpec[] = [
  {
    name: 'Code Task',
    taskType: 'code',
    descriptionMarkdown:
      '## Goal\n{{goal}}\n\n## Implementation notes\n- \n\n## Out of scope\n- ',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Implementation matches the stated goal and existing code style.' },
      { kind: 'rule', text: 'Unit tests cover the new behavior and pass locally.' },
      { kind: 'rule', text: 'No linter / type errors introduced.' },
    ],
    defaultLabels: ['code'],
  },
  {
    name: 'Bug Fix',
    taskType: 'bug',
    descriptionMarkdown:
      '## Steps to reproduce\n1. \n\n## Expected\n{{expected}}\n\n## Actual\n{{actual}}',
    acceptanceCriteria: [
      { kind: 'scenario', text: 'Given the reproduction steps, when the fix is applied, then the expected behavior occurs.' },
      { kind: 'rule', text: 'A regression test reproduces the bug and now passes.' },
    ],
    defaultPriority: 2,
    defaultLabels: ['bug'],
  },
  {
    name: 'Content Piece',
    taskType: 'content',
    descriptionMarkdown: '## Brief\n{{brief}}\n\n## Audience\n{{audience}}\n\n## Tone\n',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Content matches the brief, audience and tone.' },
      { kind: 'rule', text: 'Proofread - no spelling or grammar errors.' },
    ],
    defaultLabels: ['content'],
  },
  {
    name: 'Design Task',
    taskType: 'design',
    descriptionMarkdown: '## Problem\n{{problem}}\n\n## Constraints\n- ',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Deliverable addresses the stated problem within the constraints.' },
      { kind: 'rule', text: 'Source/editable files are linked, not just exports.' },
    ],
    defaultLabels: ['design'],
  },
  {
    name: 'Research',
    taskType: 'research',
    descriptionMarkdown: '## Question\n{{question}}\n\n## Deliverable\nA written summary with sources.',
    acceptanceCriteria: [
      { kind: 'rule', text: 'The research question is answered with cited sources.' },
      { kind: 'rule', text: 'Key findings and recommendation are summarized up top.' },
    ],
    defaultLabels: ['research'],
  },
  {
    name: 'Data Analysis',
    taskType: 'data_analysis',
    descriptionMarkdown: '## Dataset\n{{dataset}}\n\n## Question\n{{question}}',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Analysis answers the question with reproducible steps.' },
      { kind: 'rule', text: 'Charts/tables are labeled and the method is documented.' },
    ],
    defaultLabels: ['data'],
  },
  {
    name: 'Marketing Task',
    taskType: 'marketing',
    descriptionMarkdown: '## Objective\n{{objective}}\n\n## Channel\n{{channel}}',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Deliverable supports the objective on the chosen channel.' },
      { kind: 'rule', text: 'Success metric is defined.' },
    ],
    defaultLabels: ['marketing'],
  },
  {
    name: 'Event',
    taskType: 'event',
    descriptionMarkdown: '## Event\n{{event}}\n\n## Date\n{{date}}\n\n## Checklist\n- ',
    acceptanceCriteria: [
      { kind: 'rule', text: 'All checklist items are complete before the event date.' },
    ],
    defaultLabels: ['event'],
  },
  {
    name: 'Documentation',
    taskType: 'documentation',
    descriptionMarkdown: '## Topic\n{{topic}}\n\n## Where it lives\n',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Docs are accurate, complete and follow the existing style.' },
      { kind: 'rule', text: 'Examples are tested and runnable.' },
    ],
    defaultLabels: ['docs'],
  },
  {
    name: 'DevOps Task',
    taskType: 'devops',
    descriptionMarkdown: '## Change\n{{change}}\n\n## Rollback plan\n',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Change is applied and verified in the target environment.' },
      { kind: 'rule', text: 'A rollback plan is documented.' },
    ],
    defaultLabels: ['devops'],
  },
  {
    name: 'QA Pass',
    taskType: 'qa',
    descriptionMarkdown: '## Scope\n{{scope}}\n\n## Test plan\n- ',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Every item in the test plan is executed and its result recorded.' },
      { kind: 'rule', text: 'Defects found are filed as linked bug tasks.' },
    ],
    defaultLabels: ['qa'],
  },
  {
    name: 'Code Audit',
    taskType: 'code_audit',
    descriptionMarkdown: '## Target\n{{target}}\n\n## Threat model\n',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Findings are categorized by severity with reproduction details.' },
      { kind: 'rule', text: 'Each finding has a concrete remediation recommendation.' },
    ],
    defaultPriority: 2,
    defaultLabels: ['audit'],
  },
  {
    name: 'Doc Review',
    taskType: 'doc_review',
    descriptionMarkdown: '## Document\n{{document}}\n\n## Focus\n',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Review covers accuracy, completeness and clarity.' },
      { kind: 'rule', text: 'Comments are actionable and reference specific sections.' },
    ],
    defaultLabels: ['review'],
  },
  {
    name: 'Translation',
    taskType: 'translation',
    descriptionMarkdown: '## Source language\n{{source}}\n\n## Target language\n{{target}}',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Translation preserves meaning, tone and formatting.' },
      { kind: 'rule', text: 'Domain terminology is consistent throughout.' },
    ],
    defaultLabels: ['translation'],
  },
  {
    name: 'Education / Tutorial',
    taskType: 'education',
    descriptionMarkdown: '## Topic\n{{topic}}\n\n## Learner level\n{{level}}',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Material is accurate and appropriate for the learner level.' },
      { kind: 'rule', text: 'Includes a worked example and a check-for-understanding.' },
    ],
    defaultLabels: ['education'],
  },
  {
    name: 'Legal Task',
    taskType: 'legal',
    descriptionMarkdown:
      '## Request\n{{request}}\n\n## Jurisdiction\n{{jurisdiction}}\n\n> AI-generated assistance only - not legal advice.',
    acceptanceCriteria: [
      DISCLAIMER,
      { kind: 'rule', text: 'Output addresses the request for the stated jurisdiction.' },
      { kind: 'rule', text: 'Assumptions and limitations are stated explicitly.' },
    ],
    defaultLabels: ['legal'],
  },
  {
    name: 'Finance Task',
    taskType: 'finance',
    descriptionMarkdown:
      '## Request\n{{request}}\n\n## Assumptions\n- \n\n> AI-generated assistance only - not financial advice.',
    acceptanceCriteria: [
      DISCLAIMER,
      { kind: 'rule', text: 'Numbers are sourced and the methodology is shown.' },
      { kind: 'rule', text: 'Assumptions and limitations are stated explicitly.' },
    ],
    defaultLabels: ['finance'],
  },
  {
    name: 'Custom Task',
    taskType: 'custom',
    descriptionMarkdown: '## Description\n{{description}}',
    acceptanceCriteria: [
      { kind: 'rule', text: 'Deliverable meets the agreed-upon definition of done.' },
    ],
    defaultLabels: [],
  },
];

/** Coerce a builtin AC spec list into stored AcceptanceCriterion[] (with ids). */
function specToStoredCriteria(
  specs: Array<{ kind: AcceptanceCriterionKind; text: string }>,
): AcceptanceCriterion[] {
  return specs.map((s) => ({ id: randomUUID(), kind: s.kind, text: s.text, done: false }));
}

/**
 * Seed the builtin templates into a workspace inside the bootstrap transaction.
 * Called from the workspace-create tx alongside owner-member + DEFAULT_COLUMNS.
 * `tx` is the Drizzle transaction handle (typed as Database for convenience).
 */
export async function seedBuiltinTemplates(tx: Database, workspaceId: string): Promise<void> {
  await tx.insert(taskTemplates).values(
    BUILTIN_TEMPLATES.map((t) => ({
      workspaceId,
      projectId: null,
      name: t.name,
      taskType: t.taskType,
      descriptionMarkdown: t.descriptionMarkdown,
      acceptanceCriteria: specToStoredCriteria(t.acceptanceCriteria),
      defaultPriority: t.defaultPriority ?? null,
      defaultLabels: t.defaultLabels ?? null,
      defaultEstimateMinutes: t.defaultEstimateMinutes ?? null,
      fieldDefaults: null,
      requiredFields: t.requiredFields ?? null,
      builtin: true,
    })),
  );
}

/**
 * Idempotently ensure the builtin templates exist for an already-bootstrapped
 * workspace (e.g. the live production workspace created before templates
 * shipped). Inserts only the missing builtins, matched by (taskType, builtin)
 * on the workspace-wide (projectId IS NULL) scope. Returns the number inserted.
 */
export async function backfillBuiltinTemplates(db: Database, workspaceId: string): Promise<number> {
  const existing = await db
    .select({ taskType: taskTemplates.taskType })
    .from(taskTemplates)
    .where(
      and(
        eq(taskTemplates.workspaceId, workspaceId),
        eq(taskTemplates.builtin, true),
        isNull(taskTemplates.projectId),
      ),
    );
  const have = new Set(existing.map((r) => r.taskType));
  const missing = BUILTIN_TEMPLATES.filter((t) => !have.has(t.taskType));
  if (missing.length === 0) return 0;
  await db.insert(taskTemplates).values(
    missing.map((t) => ({
      workspaceId,
      projectId: null,
      name: t.name,
      taskType: t.taskType,
      descriptionMarkdown: t.descriptionMarkdown,
      acceptanceCriteria: specToStoredCriteria(t.acceptanceCriteria),
      defaultPriority: t.defaultPriority ?? null,
      defaultLabels: t.defaultLabels ?? null,
      defaultEstimateMinutes: t.defaultEstimateMinutes ?? null,
      fieldDefaults: null,
      requiredFields: t.requiredFields ?? null,
      builtin: true,
    })),
  );
  return missing.length;
}
