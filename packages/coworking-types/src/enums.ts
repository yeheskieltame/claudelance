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

export type DependencyType = 'blocks' | 'relates_to' | 'duplicates';
export const DEPENDENCY_TYPES = ['blocks', 'relates_to', 'duplicates'] as const;

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
  | 'automation.fired';

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
] as const;
