// Map Drizzle rows to the JSON DTO shapes in coworking-types: Date -> ISO
// string, bigint -> decimal string, jsonb -> object.

import type { InferSelectModel } from 'drizzle-orm';

import type {
  Activity,
  ApiKeyInfo,
  ApiKeyWithSecret,
  Comment,
  DependencyType,
  Goal,
  GoalLink,
  GoalStatus,
  Member,
  MemberKind,
  MemberRole,
  Project,
  ProjectStatus,
  StatusCategory,
  StatusColumn,
  Task,
  TaskDependency,
  TaskPriority,
  TimeEntry,
  TimeEntrySource,
  Workspace,
} from '@yeheskieltame/claudelance-coworking-types';

import type {
  activities,
  apiKeys,
  comments,
  goalLinks,
  goals,
  members,
  projects,
  statusColumns,
  taskDependencies,
  tasks,
  timeEntries,
  workspaces,
} from '../db/schema.js';

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d === null ? null : d.toISOString());

export function serializeWorkspace(r: InferSelectModel<typeof workspaces>): Workspace {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    ownerAddress: r.ownerAddress,
    isPremium: r.isPremium,
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

export function serializeTask(r: InferSelectModel<typeof tasks>): Task {
  return {
    id: r.id,
    projectId: r.projectId,
    number: r.number,
    title: r.title,
    description: r.description,
    statusColumnId: r.statusColumnId,
    assigneeMemberId: r.assigneeMemberId,
    priority: r.priority as TaskPriority,
    parentTaskId: r.parentTaskId,
    estimateMinutes: r.estimateMinutes,
    dueDate: isoOrNull(r.dueDate),
    createdByMemberId: r.createdByMemberId,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    completedAt: isoOrNull(r.completedAt),
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
