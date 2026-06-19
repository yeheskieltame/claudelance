// JSON-serialized entity shapes returned by the Coworking API. Timestamps are
// ISO-8601 strings; on-chain identifiers (agentId, linkedBountyId) are decimal
// strings so they survive JSON without bigint precision loss.

import type {
  AcceptanceCriterionKind,
  CompletionReason,
  DependencyType,
  GoalStatus,
  MemberKind,
  MemberRole,
  ProjectStatus,
  ResetScope,
  ReviewVerdict,
  StatusCategory,
  TaskPriority,
  TaskType,
  TimeEntrySource,
  ActivityVerb,
} from './enums.js';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  ownerAddress: string | null;
  isPremium: boolean;
  /** When false, destructive reset endpoints are disabled for this workspace. */
  allowReset: boolean;
  /** Workspace-level Definition of Done template applied to new tasks. */
  definitionOfDone: DoDItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  workspaceId: string;
  kind: MemberKind;
  displayName: string;
  address: string | null;
  /** ERC-8004 agent id, when linked. Serialized as a decimal string. */
  agentId: string | null;
  email: string | null;
  role: MemberRole;
  createdAt: string;
}

/** Public-safe API key view - never includes the secret or its hash. */
export interface ApiKeyInfo {
  id: string;
  workspaceId: string;
  memberId: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Returned exactly once at creation - the only time the full secret is exposed. */
export interface ApiKeyWithSecret extends ApiKeyInfo {
  key: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  /** Optional link to a Claudelance marketplace bounty id (decimal string). */
  linkedBountyId: string | null;
  createdByMemberId: string | null;
  /** Soft-delete timestamp; non-null means the project is in the trash. */
  trashedAt: string | null;
  trashedByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusColumn {
  id: string;
  projectId: string;
  key: string;
  name: string;
  position: number;
  category: StatusCategory;
  createdAt: string;
}

/**
 * An acceptance-criterion item - the authoritative completion signal for a task
 * in the v2 task model. `rule` items are flat assertions; `scenario` items are
 * Gherkin-ish given/when/then strings. Evidence + reviewer fields are filled in
 * when the item is checked off.
 */
export interface AcceptanceCriterion {
  id: string;
  kind: AcceptanceCriterionKind;
  text: string;
  done: boolean;
  verification?: string;
  evidenceUrl?: string;
  evidenceHash?: string;
  checkedBy?: string;
  checkedAt?: string;
}

/** A Definition-of-Done checklist item (lighter-weight than acceptance criteria). */
export interface DoDItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string | null;
  /** Task type taxonomy (default 'generic'); 11 of these map to bounty types. */
  type: TaskType;
  /** Per-type advisory field bag - accepts any keys, never rejects unknowns. */
  fields: Record<string, unknown> | null;
  /** Authoritative completion criteria. Empty array on legacy tasks. */
  acceptanceCriteria: AcceptanceCriterion[];
  acceptanceNotes: string | null;
  definitionOfDone: DoDItem[];
  statusColumnId: string;
  assigneeMemberId: string | null;
  /** Accountable reviewer (RACI). May equal the assignee in v2. */
  reviewerMemberId: string | null;
  /** Reporter = the creating member, surfaced under a RACI-friendly name. */
  reporterMemberId: string | null;
  priority: TaskPriority;
  parentTaskId: string | null;
  estimateMinutes: number | null;
  /** Story-point style estimate (real number), distinct from estimateMinutes. */
  estimatePoints: number | null;
  startDate: string | null;
  dueDate: string | null;
  /** Why the task reached a terminal state, if it did. */
  completionReason: CompletionReason | null;
  createdByMemberId: string | null;
  /** Soft-delete timestamp; non-null means the task is in the trash. */
  trashedAt: string | null;
  trashedByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Inlined on the GET /tasks list view to avoid an N+1 round-trip. */
  labels?: Label[];
  /** Acceptance-criteria progress, inlined on the GET /tasks list view. */
  acProgress?: { done: number; total: number };
}

export interface TaskDependency {
  id: string;
  blockerTaskId: string;
  blockedTaskId: string;
  type: DependencyType;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorMemberId: string | null;
  body: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  actorMemberId: string | null;
  verb: ActivityVerb | string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  memberId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  source: TimeEntrySource;
  note: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  dueDate: string | null;
  status: GoalStatus;
  /** Computed completion fraction in [0, 1]; present on goal reads. */
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalLink {
  id: string;
  goalId: string;
  projectId: string | null;
  taskId: string | null;
  weight: number;
  createdAt: string;
}

export interface Automation {
  id: string;
  projectId: string;
  name: string;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Webhook {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastStatus: number | null;
  createdAt: string;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

/** A recorded review verdict on a task (the request-review loop). */
export interface TaskReview {
  id: string;
  taskId: string;
  reviewerMemberId: string | null;
  verdict: ReviewVerdict;
  comment: string | null;
  /** Optional 1-5 quality score; mirrors the ERC-8004 feedback scale. */
  score: number | null;
  createdAt: string;
}

/** A reusable task scaffold (builtin or workspace-authored). */
export interface TaskTemplate {
  id: string;
  workspaceId: string;
  /** When set, the template is scoped to a single project. */
  projectId: string | null;
  name: string;
  taskType: TaskType;
  descriptionMarkdown: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  defaultPriority: TaskPriority | null;
  defaultLabels: string[] | null;
  defaultEstimateMinutes: number | null;
  fieldDefaults: Record<string, unknown> | null;
  requiredFields: string[] | null;
  /** True for the ~15 seeded built-in templates (one per type). */
  builtin: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Junction row: a member watching a task (the RACI "Informed" set). */
export interface TaskWatcher {
  taskId: string;
  memberId: string;
  createdAt: string;
}

/**
 * Dry-run output of a reset: what WOULD be soft-deleted, plus the server
 * confirmation token to replay on the destructive commit call.
 */
export interface ResetPreview {
  scope: ResetScope;
  targetId: string | null;
  /** Per-entity counts that the destructive call will affect. */
  counts: Record<string, number>;
  /** Opaque confirmation token, bound to a hash of the current counts. */
  confirmationToken: string;
  /** ISO timestamp after which the token is rejected (422). */
  expiresAt: string;
}

/** Result of a committed reset. */
export interface ResetResult {
  scope: ResetScope;
  targetId: string | null;
  /** Per-entity counts that were actually soft-deleted / created. */
  counts: Record<string, number>;
  performedAt: string;
}

/**
 * A pending ERC-8004 reputation write-back: an approved task review whose
 * assignee is an agent with a linked agentId, not yet recorded on-chain. Served
 * to the off-chain relayer (the bridge), which records a positive feedback
 * signal for the agentId and acks back. coworking-api stays fully off-chain; it
 * only surfaces what is owed and remembers what has been acked.
 */
export interface PendingReputationItem {
  /** = TaskReview.id; the idempotency unit acked back via POST /reputation/ack. */
  reviewId: string;
  taskId: string;
  /** Human-facing task number within its project. */
  taskNumber: number;
  /** Task type taxonomy; maps to an on-chain bounty type where applicable. */
  taskType: TaskType;
  projectId: string;
  /** The project's linked marketplace bounty id (decimal string), if any. */
  linkedBountyId: string | null;
  /** ERC-8004 agent id of the assignee member. Serialized as a decimal string. */
  agentId: string;
  assigneeMemberId: string;
  /** ISO-8601 timestamp the approving review was recorded. */
  reviewedAt: string;
  /** Optional 1-5 quality score from the review, if the reviewer set one. */
  score: number | null;
}

/** An immutable audit-log entry for sensitive (esp. destructive) actions. */
export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorMemberId: string | null;
  apiKeyId: string | null;
  action: string;
  scope: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}
