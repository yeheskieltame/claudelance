// Map Drizzle rows to the JSON DTO shapes in coworking-types: Date -> ISO
// string, bigint -> decimal string, jsonb -> object.

import type { InferSelectModel } from 'drizzle-orm';

import type {
  AcceptanceCriterion,
  Activity,
  ApiKeyInfo,
  ApiKeyWithSecret,
  AuditEvent,
  Automation,
  Comment,
  CompletionReason,
  DependencyType,
  DoDItem,
  Goal,
  GoalLink,
  GoalStatus,
  Label,
  Member,
  MemberKind,
  MemberRole,
  PendingReputationItem,
  Project,
  ProjectStatus,
  ReviewVerdict,
  StatusCategory,
  StatusColumn,
  Task,
  TaskDependency,
  TaskPriority,
  TaskReview,
  TaskTemplate,
  TaskType,
  TimeEntry,
  TimeEntrySource,
  Webhook,
  Workspace,
} from '@yeheskieltame/claudelance-coworking-types';

import type {
  activities,
  apiKeys,
  auditLog,
  automations,
  comments,
  goalLinks,
  goals,
  labels,
  members,
  projects,
  statusColumns,
  taskDependencies,
  taskReviews,
  tasks,
  taskTemplates,
  timeEntries,
  webhooks,
  workspaces,
} from '../db/schema.js';

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d === null ? null : d.toISOString());

// jsonb columns come back as `unknown`; coerce array-shaped columns to a typed
// array, tolerating null/non-array (legacy rows) by falling back to [].
const jsonArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function serializeWorkspace(r: InferSelectModel<typeof workspaces>): Workspace {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    ownerAddress: r.ownerAddress,
    isPremium: r.isPremium,
    allowReset: r.allowReset,
    definitionOfDone: jsonArray<DoDItem>(r.definitionOfDone),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function serializeMember(r: InferSelectModel<typeof members>): Member {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    kind: r.kind as MemberKind,
    displayName: r.displayName,
    address: r.address,
    agentId: r.agentId === null ? null : r.agentId.toString(),
    email: r.email,
    role: r.role as MemberRole,
    expertise: r.expertise,
    createdAt: iso(r.createdAt),
  };
}

export function serializeApiKeyInfo(r: InferSelectModel<typeof apiKeys>): ApiKeyInfo {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    memberId: r.memberId,
    name: r.name,
    prefix: r.prefix,
    scopes: r.scopes,
    lastUsedAt: isoOrNull(r.lastUsedAt),
    revokedAt: isoOrNull(r.revokedAt),
    createdAt: iso(r.createdAt),
  };
}

export function serializeApiKeyWithSecret(
  r: InferSelectModel<typeof apiKeys>,
  key: string,
): ApiKeyWithSecret {
  return { ...serializeApiKeyInfo(r), key };
}

export function serializeProject(r: InferSelectModel<typeof projects>): Project {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    key: r.key,
    name: r.name,
    description: r.description,
    status: r.status as ProjectStatus,
    linkedBountyId: r.linkedBountyId === null ? null : r.linkedBountyId.toString(),
    createdByMemberId: r.createdByMemberId,
    trashedAt: isoOrNull(r.trashedAt),
    trashedByMemberId: r.trashedByMemberId,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function serializeStatusColumn(r: InferSelectModel<typeof statusColumns>): StatusColumn {
  return {
    id: r.id,
    projectId: r.projectId,
    key: r.key,
    name: r.name,
    position: r.position,
    category: r.category as StatusCategory,
    createdAt: iso(r.createdAt),
  };
}

/**
 * Extra fields inlined on the GET /tasks list view (the route resolves them in a
 * single batched query to avoid N+1). Omitted on single-task reads.
 */
interface TaskExtras {
  labels?: Label[];
  acProgress?: { done: number; total: number };
}

export function serializeTask(r: InferSelectModel<typeof tasks>, extras?: TaskExtras): Task {
  return {
    id: r.id,
    projectId: r.projectId,
    number: r.number,
    title: r.title,
    description: r.description,
    type: r.type as TaskType,
    fields: (r.fields as Record<string, unknown> | null) ?? null,
    acceptanceCriteria: jsonArray<AcceptanceCriterion>(r.acceptanceCriteria),
    acceptanceNotes: r.acceptanceNotes,
    definitionOfDone: jsonArray<DoDItem>(r.definitionOfDone),
    statusColumnId: r.statusColumnId,
    assigneeMemberId: r.assigneeMemberId,
    reviewerMemberId: r.reviewerMemberId,
    // Reporter is the creating member, surfaced under a RACI-friendly alias.
    reporterMemberId: r.createdByMemberId,
    priority: r.priority as TaskPriority,
    parentTaskId: r.parentTaskId,
    estimateMinutes: r.estimateMinutes,
    estimatePoints: r.estimatePoints,
    startDate: isoOrNull(r.startDate),
    dueDate: isoOrNull(r.dueDate),
    completionReason: (r.completionReason as CompletionReason | null) ?? null,
    createdByMemberId: r.createdByMemberId,
    trashedAt: isoOrNull(r.trashedAt),
    trashedByMemberId: r.trashedByMemberId,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    completedAt: isoOrNull(r.completedAt),
    ...(extras?.labels !== undefined ? { labels: extras.labels } : {}),
    ...(extras?.acProgress !== undefined ? { acProgress: extras.acProgress } : {}),
  };
}

export function serializeComment(r: InferSelectModel<typeof comments>): Comment {
  return {
    id: r.id,
    taskId: r.taskId,
    authorMemberId: r.authorMemberId,
    body: r.body,
    createdAt: iso(r.createdAt),
  };
}

export function serializeActivity(r: InferSelectModel<typeof activities>): Activity {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    projectId: r.projectId,
    taskId: r.taskId,
    actorMemberId: r.actorMemberId,
    verb: r.verb,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
    createdAt: iso(r.createdAt),
  };
}

export function serializeTaskDependency(
  r: InferSelectModel<typeof taskDependencies>,
): TaskDependency {
  return {
    id: r.id,
    blockerTaskId: r.blockerTaskId,
    blockedTaskId: r.blockedTaskId,
    type: r.type as DependencyType,
    createdAt: iso(r.createdAt),
  };
}

export function serializeTimeEntry(r: InferSelectModel<typeof timeEntries>): TimeEntry {
  return {
    id: r.id,
    taskId: r.taskId,
    memberId: r.memberId,
    startedAt: iso(r.startedAt),
    endedAt: isoOrNull(r.endedAt),
    durationSeconds: r.durationSeconds,
    source: r.source as TimeEntrySource,
    note: r.note,
    createdAt: iso(r.createdAt),
  };
}

export function serializeGoal(r: InferSelectModel<typeof goals>, progress?: number): Goal {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    name: r.name,
    description: r.description,
    targetValue: r.targetValue,
    currentValue: r.currentValue,
    unit: r.unit,
    dueDate: isoOrNull(r.dueDate),
    status: r.status as GoalStatus,
    ...(progress !== undefined ? { progress } : {}),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function serializeGoalLink(r: InferSelectModel<typeof goalLinks>): GoalLink {
  return {
    id: r.id,
    goalId: r.goalId,
    projectId: r.projectId,
    taskId: r.taskId,
    weight: r.weight,
    createdAt: iso(r.createdAt),
  };
}

export function serializeAutomation(r: InferSelectModel<typeof automations>): Automation {
  return {
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    trigger: (r.trigger as Record<string, unknown> | null) ?? {},
    action: (r.action as Record<string, unknown> | null) ?? {},
    enabled: r.enabled,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function serializeWebhook(r: InferSelectModel<typeof webhooks>): Webhook {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    url: r.url,
    events: r.events,
    enabled: r.enabled,
    lastDeliveryAt: isoOrNull(r.lastDeliveryAt),
    lastStatus: r.lastStatus,
    createdAt: iso(r.createdAt),
  };
}

export function serializeLabel(r: InferSelectModel<typeof labels>): Label {
  return {
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    color: r.color,
    createdAt: iso(r.createdAt),
  };
}

export function serializeTaskReview(r: InferSelectModel<typeof taskReviews>): TaskReview {
  return {
    id: r.id,
    taskId: r.taskId,
    reviewerMemberId: r.reviewerMemberId,
    verdict: r.verdict as ReviewVerdict,
    comment: r.comment,
    score: r.score,
    createdAt: iso(r.createdAt),
  };
}

/**
 * Serialize a row of the pending-reputation join (task review + task + assignee
 * member). Not a single-table model: the route selects the columns by hand, so
 * the input is a plain shape. bigint identifiers -> decimal strings, Date -> ISO.
 * `agentId` is non-null by construction (the query filters agentId IS NOT NULL).
 */
export function serializePendingReputationItem(r: {
  reviewId: string;
  taskId: string;
  taskNumber: number;
  taskType: string;
  projectId: string;
  linkedBountyId: bigint | null;
  agentId: bigint;
  assigneeMemberId: string;
  reviewedAt: Date;
  score: number | null;
}): PendingReputationItem {
  return {
    reviewId: r.reviewId,
    taskId: r.taskId,
    taskNumber: r.taskNumber,
    taskType: r.taskType as TaskType,
    projectId: r.projectId,
    linkedBountyId: r.linkedBountyId === null ? null : r.linkedBountyId.toString(),
    agentId: r.agentId.toString(),
    assigneeMemberId: r.assigneeMemberId,
    reviewedAt: iso(r.reviewedAt),
    score: r.score,
  };
}

export function serializeTaskTemplate(r: InferSelectModel<typeof taskTemplates>): TaskTemplate {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    projectId: r.projectId,
    name: r.name,
    taskType: r.taskType as TaskType,
    descriptionMarkdown: r.descriptionMarkdown,
    acceptanceCriteria: jsonArray<AcceptanceCriterion>(r.acceptanceCriteria),
    defaultPriority: r.defaultPriority === null ? null : (r.defaultPriority as TaskPriority),
    defaultLabels: r.defaultLabels,
    defaultEstimateMinutes: r.defaultEstimateMinutes,
    fieldDefaults: (r.fieldDefaults as Record<string, unknown> | null) ?? null,
    requiredFields: r.requiredFields,
    builtin: r.builtin,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function serializeAuditEvent(r: InferSelectModel<typeof auditLog>): AuditEvent {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    actorMemberId: r.actorMemberId,
    apiKeyId: r.apiKeyId,
    action: r.action,
    scope: r.scope,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
    createdAt: iso(r.createdAt),
  };
}
