// Drizzle schema for Claudelance Coworking (Postgres). String-literal enums live
// in @yeheskieltame/claudelance-coworking-types and are enforced at the app
// layer (zod) rather than as pg enums, so columns can evolve without ALTER TYPE.

import { randomUUID } from 'node:crypto';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const pk = () => text('id').primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const workspaces = pgTable('workspaces', {
  id: pk(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  ownerAddress: text('owner_address'),
  isPremium: boolean('is_premium').default(false).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const members = pgTable(
  'members',
  {
    id: pk(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('agent'),
    displayName: text('display_name').notNull(),
    address: text('address'),
    agentId: bigint('agent_id', { mode: 'bigint' }),
    email: text('email'),
    role: text('role').notNull().default('member'),
    createdAt: createdAt(),
  },
  (t) => ({
    workspaceIdx: index('members_workspace_idx').on(t.workspaceId),
    // NULL addresses are distinct in Postgres, so multiple wallet-less humans
    // per workspace are fine; the uniqueness only bites for real addresses.
    workspaceAddressUq: uniqueIndex('members_workspace_address_uq').on(t.workspaceId, t.address),
  }),
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: pk(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('default'),
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    scopes: text('scopes').array().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    hashUq: uniqueIndex('api_keys_hash_uq').on(t.keyHash),
    workspaceIdx: index('api_keys_workspace_idx').on(t.workspaceId),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: pk(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    linkedBountyId: bigint('linked_bounty_id', { mode: 'bigint' }),
    createdByMemberId: text('created_by_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    workspaceKeyUq: uniqueIndex('projects_workspace_key_uq').on(t.workspaceId, t.key),
  }),
);

export const statusColumns = pgTable(
  'status_columns',
  {
    id: pk(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    category: text('category').notNull().default('unstarted'),
    createdAt: createdAt(),
  },
  (t) => ({
    projectKeyUq: uniqueIndex('status_columns_project_key_uq').on(t.projectId, t.key),
  }),
);

export const tasks = pgTable(
  'tasks',
  {
    id: pk(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    statusColumnId: text('status_column_id')
      .notNull()
      .references(() => statusColumns.id, { onDelete: 'restrict' }),
    assigneeMemberId: text('assignee_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    priority: smallint('priority').notNull().default(0),
    parentTaskId: text('parent_task_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'set null',
    }),
    estimateMinutes: integer('estimate_minutes'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    createdByMemberId: text('created_by_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    projectNumberUq: uniqueIndex('tasks_project_number_uq').on(t.projectId, t.number),
    projectStatusIdx: index('tasks_project_status_idx').on(t.projectId, t.statusColumnId),
    assigneeIdx: index('tasks_assignee_idx').on(t.assigneeMemberId),
  }),
);

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: pk(),
    blockerTaskId: text('blocker_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    blockedTaskId: text('blocked_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('blocks'),
    createdAt: createdAt(),
  },
  (t) => ({
    pairUq: uniqueIndex('task_dependencies_pair_uq').on(
      t.blockerTaskId,
      t.blockedTaskId,
      t.type,
    ),
    blockedIdx: index('task_dependencies_blocked_idx').on(t.blockedTaskId),
  }),
);

export const comments = pgTable(
  'comments',
  {
    id: pk(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorMemberId: text('author_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    taskIdx: index('comments_task_idx').on(t.taskId, t.createdAt),
  }),
);

export const activities = pgTable(
  'activities',
  {
    id: pk(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    actorMemberId: text('actor_member_id').references(() => members.id, { onDelete: 'set null' }),
    verb: text('verb').notNull(),
    payload: jsonb('payload'),
    createdAt: createdAt(),
  },
  (t) => ({
    workspaceCreatedIdx: index('activities_workspace_created_idx').on(t.workspaceId, t.createdAt),
    projectCreatedIdx: index('activities_project_created_idx').on(t.projectId, t.createdAt),
  }),
);

export const timeEntries = pgTable(
  'time_entries',
  {
    id: pk(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    source: text('source').notNull().default('timer'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => ({
    taskIdx: index('time_entries_task_idx').on(t.taskId),
    memberIdx: index('time_entries_member_idx').on(t.memberId),
  }),
);

export const goals = pgTable('goals', {
  id: pk(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  targetValue: real('target_value'),
  currentValue: real('current_value').notNull().default(0),
  unit: text('unit'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: text('status').notNull().default('on_track'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const goalLinks = pgTable('goal_links', {
  id: pk(),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  weight: real('weight').notNull().default(1),
  createdAt: createdAt(),
});

export const automations = pgTable('automations', {
  id: pk(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  trigger: jsonb('trigger').notNull(),
  action: jsonb('action').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const webhooks = pgTable('webhooks', {
  id: pk(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').array().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
  lastStatus: integer('last_status'),
  createdAt: createdAt(),
});

export const labels = pgTable(
  'labels',
  {
    id: pk(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: createdAt(),
  },
  (t) => ({
    projectNameUq: uniqueIndex('labels_project_name_uq').on(t.projectId, t.name),
  }),
);

export const taskLabels = pgTable(
  'task_labels',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.labelId] }),
  }),
);
