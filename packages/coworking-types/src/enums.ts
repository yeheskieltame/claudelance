// Enumerations and label maps shared across the Coworking API, SDK, and UI.
// Kept as string-literal unions + const arrays (no runtime deps) so this package
// stays dependency-free, mirroring @yeheskieltame/claudelance-types.

export type MemberKind = 'human' | 'agent';
export const MEMBER_KINDS = ['human', 'agent'] as const;

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export const MEMBER_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived';
export const PROJECT_STATUSES = [
  'planning',
  'active',
  'paused',
  'completed',
  'archived',
] as const;

/**
 * Semantic bucket a board column maps to. Coordination queries (whats_next,
 * progress roll-up) rely on these rather than the human-facing column name, so a
 * project can rename "In Progress" to "Cooking" without breaking agent logic.
 */
export type StatusCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
export const STATUS_CATEGORIES = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const;

/** Linear-style priority: 0 = none, 1 = urgent ... 4 = low. */
export type TaskPriority = 0 | 1 | 2 | 3 | 4;
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  0: 'None',
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
};

/**
 * Task type taxonomy. The first 11 values are aligned with the on-chain
 * Claudelance bounty types (0-10, see CW_TASKTYPE_TO_BOUNTYTYPE), the rest are
 * PM-native types that have no marketplace analogue. Stored as a free text
 * column (default 'generic'); this is the well-known set validated app-side.
 */
export type TaskType =
  | 'generic'
  | 'code'
  | 'bug'
  | 'content'
  | 'design'
  | 'research'
  | 'data_analysis'
  | 'marketing'
  | 'event'
  | 'documentation'
  | 'devops'
  | 'qa'
  | 'code_audit'
  | 'doc_review'
  | 'translation'
  | 'education'
  | 'legal'
  | 'finance'
  | 'custom';

export const TASK_TYPES = [
  'generic',
  'code',
  'bug',
  'content',
  'design',
  'research',
  'data_analysis',
  'marketing',
  'event',
  'documentation',
  'devops',
  'qa',
  'code_audit',
  'doc_review',
  'translation',
  'education',
  'legal',
  'finance',
  'custom',
] as const;

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  generic: 'Generic',
  code: 'Code',
  bug: 'Bug',
  content: 'Content',
  design: 'Design',
  research: 'Research',
  data_analysis: 'Data Analysis',
  marketing: 'Marketing',
  event: 'Event',
  documentation: 'Documentation',
  devops: 'DevOps',
  qa: 'QA',
  code_audit: 'Code Audit',
  doc_review: 'Doc Review',
  translation: 'Translation',
  education: 'Education',
  legal: 'Legal',
  finance: 'Finance',
  custom: 'Custom',
};

/**
 * Maps a Coworking task type to its on-chain Claudelance bounty type id (0-10,
 * see docs/v3-task-catalog.md). Only the 11 marketplace-aligned types map;
 * PM-native types (bug, design, marketing, event, devops, qa, generic) are
 * intentionally omitted (undefined) - they have no bounty analogue.
 */
export const CW_TASKTYPE_TO_BOUNTYTYPE: Partial<Record<TaskType, number>> = {
  code: 0,
  data_analysis: 1,
  research: 2,
  content: 3,
  doc_review: 4,
  code_audit: 5,
  translation: 6,
  education: 7,
  legal: 8,
  finance: 9,
  custom: 10,
};

/** Kind of an acceptance-criterion item: a flat rule or a Gherkin-ish scenario. */
export type AcceptanceCriterionKind = 'rule' | 'scenario';
export const ACCEPTANCE_CRITERION_KINDS = ['rule', 'scenario'] as const;

/** Verdict recorded when a reviewer acts on a review request. */
export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';
export const REVIEW_VERDICTS = ['approved', 'changes_requested', 'rejected'] as const;

/** Why a task reached a terminal state (mirrors GitHub-style close reasons). */
export type CompletionReason = 'completed' | 'canceled' | 'not_planned' | 'duplicate';
export const COMPLETION_REASONS = ['completed', 'canceled', 'not_planned', 'duplicate'] as const;

/** Scope of a destructive reset: a single project, the whole workspace, or demo seeding. */
export type ResetScope = 'project' | 'workspace' | 'demo';
export const RESET_SCOPES = ['project', 'workspace', 'demo'] as const;

export type DependencyType = 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates';
export const DEPENDENCY_TYPES = ['blocks', 'blocked_by', 'relates_to', 'duplicates'] as const;

export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'done';
export const GOAL_STATUSES = ['on_track', 'at_risk', 'off_track', 'done'] as const;

export type TimeEntrySource = 'timer' | 'manual';
export const TIME_ENTRY_SOURCES = ['timer', 'manual'] as const;

/**
 * Canonical activity verbs written to the blackboard (activities table). Agents
 * poll / subscribe to these to learn what changed in a project. Open-ended on
 * purpose - stored as a free string; this is the well-known set.
 */
export type ActivityVerb =
  | 'workspace.created'
  | 'member.joined'
  | 'project.created'
  | 'project.updated'
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.assigned'
  | 'task.claimed'
  | 'task.completed'
  | 'comment.added'
  | 'dependency.added'
  | 'dependency.resolved'
  | 'time.checked_in'
  | 'time.checked_out'
  | 'goal.created'
  | 'goal.progressed'
  | 'automation.fired'
  | 'reviewer.assigned'
  | 'review.requested'
  | 'review.approved'
  | 'review.changes_requested'
  | 'review.rejected'
  | 'task.reopened'
  | 'task.completed_with_unmet_criteria'
  | 'assignee.changed'
  | 'watcher.added'
  | 'watcher.removed'
  | 'task.from_template'
  | 'task.labels_set'
  | 'template.created'
  | 'project.reset'
  | 'workspace.cleared'
  | 'workspace.seeded_demo'
  | 'workspace.updated'
  | 'project.archived'
  | 'project.trashed'
  | 'project.restored'
  | 'task.trashed'
  | 'task.restored';

export const ACTIVITY_VERBS = [
  'workspace.created',
  'member.joined',
  'project.created',
  'project.updated',
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.assigned',
  'task.claimed',
  'task.completed',
  'comment.added',
  'dependency.added',
  'dependency.resolved',
  'time.checked_in',
  'time.checked_out',
  'goal.created',
  'goal.progressed',
  'automation.fired',
  'reviewer.assigned',
  'review.requested',
  'review.approved',
  'review.changes_requested',
  'review.rejected',
  'task.reopened',
  'task.completed_with_unmet_criteria',
  'assignee.changed',
  'watcher.added',
  'watcher.removed',
  'task.from_template',
  'task.labels_set',
  'template.created',
  'project.reset',
  'workspace.cleared',
  'workspace.seeded_demo',
  'workspace.updated',
  'project.archived',
  'project.trashed',
  'project.restored',
  'task.trashed',
  'task.restored',
] as const;
