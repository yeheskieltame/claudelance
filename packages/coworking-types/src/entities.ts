// JSON-serialized entity shapes returned by the Coworking API. Timestamps are
// ISO-8601 strings; on-chain identifiers (agentId, linkedBountyId) are decimal
// strings so they survive JSON without bigint precision loss.

import type {
  DependencyType,
  GoalStatus,
  MemberKind,
  MemberRole,
  ProjectStatus,
  StatusCategory,
  TaskPriority,
  TimeEntrySource,
  ActivityVerb,
} from './enums.js';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  ownerAddress: string | null;
  isPremium: boolean;
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

export interface Task {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string | null;
  statusColumnId: string;
  assigneeMemberId: string | null;
  priority: TaskPriority;
  parentTaskId: string | null;
  estimateMinutes: number | null;
  dueDate: string | null;
  createdByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
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
