import type {
  Activity,
  ApiKeyWithSecret,
  Comment,
  Label,
  Member,
  PendingReputationItem,
  Project,
  ResetPreview,
  ResetResult,
  ReviewVerdict,
  StatusColumn,
  Task,
  TaskDependency,
  TaskReview,
  TaskTemplate,
  TaskType,
  TaskWatcher,
  Workspace,
} from '@yeheskieltame/claudelance-coworking-types';

export interface CoworkingClientOptions {
  /** Base URL of the Coworking API, e.g. https://coworking-api.claudelance.xyz */
  baseUrl: string;
  /** Bearer API key. Required for everything except createWorkspace(). */
  apiKey?: string;
  /** Override fetch (tests, custom agents). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** Thrown when the API returns a non-2xx response. */
export class CoworkingApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'CoworkingApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
  ownerAddress?: string;
  ownerName?: string;
}

export interface CreateProjectInput {
  key: string;
  name: string;
  description?: string;
  linkedBountyId?: string;
}

/** Add a member to the workspace (POST /members; requires an admin-scoped key). */
export interface CreateMemberInput {
  displayName: string;
  kind?: 'human' | 'agent';
  address?: string;
  /** ERC-8004 agent id (decimal string) to link this member's reputation. */
  agentId?: string;
  email?: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
}

/** Issue an API key for a member (POST /keys; requires an admin-scoped key). */
export interface CreateApiKeyInput {
  memberId: string;
  name?: string;
  /** Defaults to ['read','write'] server-side. */
  scopes?: string[];
}

/** An acceptance-criterion item supplied on task create/update (ids server-filled). */
export interface AcceptanceCriterionInput {
  id?: string;
  kind?: 'rule' | 'scenario';
  text: string;
  done?: boolean;
  verification?: string;
  evidenceUrl?: string;
  evidenceHash?: string;
  /** Audit metadata recorded when a criterion is checked; passed through on edit. */
  checkedBy?: string;
  /** ISO-8601 timestamp recorded when a criterion is checked; passed through on edit. */
  checkedAt?: string;
}

/** A Definition-of-Done item supplied on task update. */
export interface DoDItemInput {
  id?: string;
  text: string;
  done?: boolean;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  /** Task type taxonomy (default 'generic'). */
  type?: TaskType;
  /** Per-type advisory field bag - any keys accepted, unknowns never rejected. */
  fields?: Record<string, unknown>;
  /** Authoritative completion criteria. */
  acceptanceCriteria?: AcceptanceCriterionInput[];
  acceptanceNotes?: string;
  priority?: number;
  assigneeMemberId?: string;
  /** Accountable reviewer (RACI); may equal the assignee. */
  reviewerMemberId?: string;
  parentTaskId?: string;
  startDate?: string;
  dueDate?: string;
  estimatePoints?: number;
  estimateMinutes?: number;
  /** Label ids to attach; each must belong to the task's project. */
  labelIds?: string[];
  /** Column key to start in; defaults to the project's first column. */
  statusColumnKey?: string;
}

/** Partial update of a task's rich fields (PATCH /tasks/:id). */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  type?: TaskType;
  fields?: Record<string, unknown> | null;
  acceptanceCriteria?: AcceptanceCriterionInput[];
  acceptanceNotes?: string | null;
  definitionOfDone?: DoDItemInput[];
  priority?: number;
  reviewerMemberId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  estimatePoints?: number | null;
  completionReason?: 'completed' | 'canceled' | 'not_planned' | 'duplicate' | null;
}

// Type aliases (not interfaces) so they satisfy the Record<string, QueryValue>
// index signature toQueryString expects.
export type ListTasksQuery = {
  projectId?: string;
  status?: string;
  assigneeMemberId?: string;
  reviewerMemberId?: string;
  type?: string;
  /** Label id or name. */
  label?: string;
  /** priority | dueDate | createdAt (default). */
  sort?: string;
  limit?: number;
  cursor?: string;
};

/** Create a reusable task template (workspace-wide, or project-scoped). */
export interface CreateTemplateInput {
  name: string;
  taskType?: TaskType;
  /** When set, scopes the template to a single (in-workspace) project. */
  projectId?: string;
  descriptionMarkdown?: string;
  /** AC items authored as { kind?, text }; materialized fresh on instantiate. */
  acceptanceCriteria?: Array<{ kind?: 'rule' | 'scenario'; text: string }>;
  defaultPriority?: number;
  defaultLabels?: string[];
  defaultEstimateMinutes?: number;
  fieldDefaults?: Record<string, unknown>;
  requiredFields?: string[];
}

/** Overrides applied when instantiating a task from a template. */
export interface TemplateOverrides {
  projectId: string;
  title?: string;
  description?: string | null;
  priority?: number;
  estimateMinutes?: number | null;
  statusColumnKey?: string;
  assigneeMemberId?: string;
  reviewerMemberId?: string;
  /** {{placeholder}} substitutions in the template body / AC. */
  vars?: Record<string, string | number>;
  /** Per-type advisory field overrides merged onto the template defaults. */
  fields?: Record<string, unknown>;
}

/** Body for committing a reset (dry-run -> commit handshake). */
export interface CommitResetInput {
  confirmationToken: string;
  confirm: boolean;
  /** Sent as the required `Idempotency-Key` header on commit calls. */
  idempotencyKey: string;
  /** Project reset only: rebuild the board to the default columns. */
  restoreDefaultColumns?: boolean;
}

/** Body for committing a demo seed (dry-run -> commit handshake). */
export interface CommitSeedDemoInput {
  confirmationToken: string;
  confirm: true;
  /** Sent as the required `Idempotency-Key` header on the commit call. */
  idempotencyKey: string;
  /** Seed the demo even when the workspace already has live projects. */
  force?: boolean;
}

export type ActivityQuery = {
  projectId?: string;
  /** ISO timestamp - only activity strictly after this is returned. */
  since?: string;
  limit?: number;
};

// Type alias (not interface) so it satisfies the Record<string, QueryValue>
// index signature toQueryString expects.
export type ListPendingReputationQuery = {
  /** Cursor: review-createdAt ISO timestamp; only reviews strictly after it. */
  since?: string;
  /** Page size, capped server-side at 200 (default 100). */
  limit?: number;
};

/** Body for acking a reputation write-back back to the bridge ledger. */
export interface AckReputationInput {
  /** = PendingReputationItem.reviewId; the idempotency unit. */
  reviewId: string;
  /** On-chain giveFeedback tx hash; omitted when the relayer ran in dry-run. */
  txHash?: string;
  /** ERC-8004 agent id the feedback was recorded for (decimal string). */
  agentId: string;
}

type QueryValue = string | number | boolean | undefined;

function toQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Thin typed client over the Coworking REST API. Usable from agents (Node) and
 * the web UI (browser). For agents, `CoworkingClient.fromEnv()` reads
 * COWORKING_API_URL + COWORKING_API_KEY.
 */
export class CoworkingClient {
  readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CoworkingClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static fromEnv(
    env: Record<string, string | undefined> = typeof process !== 'undefined'
      ? process.env
      : {},
  ): CoworkingClient {
    const baseUrl = env.COWORKING_API_URL;
    if (!baseUrl) {
      throw new Error('CoworkingClient.fromEnv(): COWORKING_API_URL is required');
    }
    return new CoworkingClient({ baseUrl, apiKey: env.COWORKING_API_KEY });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    if (extraHeaders) Object.assign(headers, extraHeaders);

    // Call through a local reference rather than `this.fetchImpl(...)`. The
    // browser's native fetch must keep its global `this`; invoking it as a
    // method of this client rebinds `this` to the instance and throws
    // "Failed to execute 'fetch' on 'Window': Illegal invocation".
    const doFetch = this.fetchImpl;
    const response = await doFetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      // Non-JSON body (e.g. an HTML 502 from a proxy). Surface a structured error
      // rather than a raw SyntaxError so callers handle all failures uniformly.
      throw new CoworkingApiError(
        response.status,
        response.ok ? `non-JSON response body: ${text.slice(0, 200)}` : text.slice(0, 200) || response.statusText,
      );
    }

    if (!response.ok) {
      const err = (data as { error?: { message?: string; code?: string; details?: unknown } })
        ?.error;
      throw new CoworkingApiError(
        response.status,
        err?.message ?? response.statusText,
        err?.code,
        err?.details,
      );
    }
    return data as T;
  }

  /** Liveness + DB health. */
  health(): Promise<{ ok: boolean; db?: string }> {
    return this.request('GET', '/health');
  }

  /** Bootstrap: create a workspace and receive its first owner API key (shown once). */
  createWorkspace(
    input: CreateWorkspaceInput,
  ): Promise<{ workspace: Workspace; apiKey: ApiKeyWithSecret }> {
    return this.request('POST', '/v1/workspaces', input);
  }

  /** The workspace the current API key belongs to. */
  getWorkspace(): Promise<Workspace> {
    return this.request('GET', '/v1/workspace');
  }

  /** The member the current API key authenticates as (the caller's own record). */
  getMe(): Promise<Member> {
    return this.request('GET', '/v1/me');
  }

  listProjects(): Promise<{ items: Project[] }> {
    return this.request('GET', '/v1/projects');
  }

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.request('POST', '/v1/projects', input);
  }

  getProject(id: string): Promise<Project> {
    return this.request('GET', `/v1/projects/${id}`);
  }

  listTasks(query: ListTasksQuery = {}): Promise<{ items: Task[]; nextCursor: string | null }> {
    return this.request('GET', `/v1/tasks${toQueryString(query)}`);
  }

  getTask(id: string): Promise<Task> {
    return this.request('GET', `/v1/tasks/${id}`);
  }

  createTask(input: CreateTaskInput): Promise<Task> {
    return this.request('POST', '/v1/tasks', input);
  }

  /** Patch a task's rich fields (title, AC, DoD, reviewer, estimates, etc.). */
  updateTask(id: string, patch: UpdateTaskInput): Promise<Task> {
    return this.request('PATCH', `/v1/tasks/${id}`, patch);
  }

  updateTaskStatus(id: string, statusColumnKey: string): Promise<Task> {
    return this.request('POST', `/v1/tasks/${id}/status`, { statusColumnKey });
  }

  claimTask(id: string): Promise<Task> {
    return this.request('POST', `/v1/tasks/${id}/claim`);
  }

  assignTask(id: string, memberId: string): Promise<Task> {
    return this.request('POST', `/v1/tasks/${id}/assign`, { memberId });
  }

  /** Declare that `taskId` is blocked by `blockerTaskId`. */
  addDependency(taskId: string, blockerTaskId: string, type?: string): Promise<TaskDependency> {
    return this.request('POST', `/v1/tasks/${taskId}/dependencies`, { blockerTaskId, type });
  }

  listComments(taskId: string): Promise<{ items: Comment[] }> {
    return this.request('GET', `/v1/tasks/${taskId}/comments`);
  }

  addComment(taskId: string, body: string): Promise<Comment> {
    return this.request('POST', `/v1/tasks/${taskId}/comments`, { body });
  }

  getActivity(query: ActivityQuery = {}): Promise<{ items: Activity[] }> {
    return this.request('GET', `/v1/activity${toQueryString(query)}`);
  }

  listColumns(projectId: string): Promise<{ items: StatusColumn[] }> {
    return this.request('GET', `/v1/projects/${projectId}/columns`);
  }

  listMembers(): Promise<{ items: Member[] }> {
    return this.request('GET', '/v1/members');
  }

  /** Add a member to the workspace. Requires an admin-scoped key. */
  createMember(input: CreateMemberInput): Promise<Member> {
    return this.request('POST', '/v1/members', input);
  }

  /** Issue an API key for a member (the secret is returned once). Admin-scoped. */
  createApiKey(input: CreateApiKeyInput): Promise<ApiKeyWithSecret> {
    return this.request('POST', '/v1/keys', input);
  }

  /** Tasks assigned to the current key's member that aren't done yet. */
  myOpenTasks(): Promise<{ items: Task[] }> {
    return this.request('GET', '/v1/me/tasks');
  }

  /** The current member's open tasks that are blocked, with their blockers. */
  whatsBlockingMe(): Promise<{ items: Array<{ task: Task; blockers: Task[] }> }> {
    return this.request('GET', '/v1/me/blocked');
  }

  /** Actionable, unblocked tasks in a project, ordered by priority. */
  whatsNext(projectId: string): Promise<{ items: Task[] }> {
    return this.request('GET', `/v1/projects/${projectId}/next`);
  }

  /** Tasks awaiting the current member's review verdict (the reviewer inbox). */
  myReviews(): Promise<{ items: Task[] }> {
    return this.request('GET', '/v1/me/reviews');
  }

  // ---- Review loop -----------------------------------------------------------

  /**
   * Move a task into review. The reviewer resolves explicit > existing > assignee;
   * an in-review column is found or created unless `statusColumnKey` overrides it.
   */
  requestReview(id: string, reviewerMemberId?: string, statusColumnKey?: string): Promise<Task> {
    return this.request('POST', `/v1/tasks/${id}/request-review`, {
      reviewerMemberId,
      statusColumnKey,
    });
  }

  /**
   * Record a review verdict. `approved` moves the task to done, `changes_requested`
   * sends it back to an in-progress column, `rejected` cancels it.
   */
  submitReview(
    id: string,
    input: { verdict: ReviewVerdict; comment?: string; score?: number },
  ): Promise<TaskReview> {
    return this.request('POST', `/v1/tasks/${id}/review`, input);
  }

  listReviews(id: string): Promise<{ items: TaskReview[] }> {
    return this.request('GET', `/v1/tasks/${id}/reviews`);
  }

  // ---- Watchers (RACI "Informed") --------------------------------------------

  listWatchers(id: string): Promise<{ items: TaskWatcher[] }> {
    return this.request('GET', `/v1/tasks/${id}/watchers`);
  }

  /** Add a watcher; defaults to the calling member when `memberId` is omitted. */
  addWatcher(id: string, memberId?: string): Promise<{ taskId: string; memberId: string }> {
    return this.request('POST', `/v1/tasks/${id}/watchers`, { memberId });
  }

  removeWatcher(id: string, memberId: string): Promise<{ ok: boolean }> {
    return this.request('DELETE', `/v1/tasks/${id}/watchers/${memberId}`);
  }

  // ---- Templates -------------------------------------------------------------

  /** List workspace templates, plus a project's own when `projectId` is given. */
  listTemplates(projectId?: string): Promise<{ items: TaskTemplate[] }> {
    return this.request('GET', `/v1/templates${toQueryString({ projectId })}`);
  }

  createTemplate(input: CreateTemplateInput): Promise<TaskTemplate> {
    return this.request('POST', '/v1/templates', input);
  }

  /** Instantiate a task from a template; `overrides` fill placeholders + fields. */
  createTaskFromTemplate(templateId: string, overrides: TemplateOverrides): Promise<Task> {
    return this.request('POST', `/v1/tasks/from-template/${templateId}`, overrides);
  }

  // ---- Labels ----------------------------------------------------------------

  listLabels(projectId: string): Promise<{ items: Label[] }> {
    return this.request('GET', `/v1/projects/${projectId}/labels`);
  }

  createLabel(projectId: string, input: { name: string; color?: string }): Promise<Label> {
    return this.request('POST', `/v1/projects/${projectId}/labels`, input);
  }

  /** Replace a task's full label set (each label must belong to its project). */
  setTaskLabels(id: string, labelIds: string[]): Promise<Task> {
    return this.request('PUT', `/v1/tasks/${id}/labels`, { labelIds });
  }

  // ---- Reset (dry-run -> commit; commit is destructive, REST-only) -----------

  /** Dry-run a project reset: returns the soft-delete counts + a commit token. */
  previewProjectReset(projectId: string): Promise<ResetPreview> {
    return this.request('POST', `/v1/projects/${projectId}/reset`, { dryRun: true });
  }

  /** Commit a project reset (soft-delete, recoverable). Sends the Idempotency-Key header. */
  commitProjectReset(projectId: string, input: CommitResetInput): Promise<ResetResult> {
    const { idempotencyKey, ...body } = input;
    return this.request('POST', `/v1/projects/${projectId}/reset`, body, {
      'idempotency-key': idempotencyKey,
    });
  }

  /** Dry-run a workspace clear: returns the soft-delete counts + a commit token. */
  previewWorkspaceClear(): Promise<ResetPreview> {
    return this.request('POST', '/v1/workspaces/current/reset', { dryRun: true });
  }

  /** Commit a workspace clear (soft-delete; members + keys preserved). */
  commitWorkspaceClear(input: CommitResetInput): Promise<ResetResult> {
    const { idempotencyKey, ...body } = input;
    return this.request('POST', '/v1/workspaces/current/reset', body, {
      'idempotency-key': idempotencyKey,
    });
  }

  /** Dry-run seeding a canned demo project: returns the create counts + a commit token. */
  previewSeedDemo(): Promise<ResetPreview> {
    return this.request('POST', '/v1/workspaces/current/seed-demo', { dryRun: true });
  }

  /**
   * Commit the demo seed (creates a sample project + tasks + deps + goal). Pass the
   * `confirmationToken` from previewSeedDemo(); the idempotencyKey is sent as the
   * required `Idempotency-Key` header, same as commitProjectReset/commitWorkspaceClear.
   */
  commitSeedDemo(input: CommitSeedDemoInput): Promise<ResetResult> {
    const { idempotencyKey, ...body } = input;
    return this.request('POST', '/v1/workspaces/current/seed-demo', body, {
      'idempotency-key': idempotencyKey,
    });
  }

  // ---- ERC-8004 reputation bridge (off-chain; admin-scoped key) --------------

  /**
   * Approved task reviews owed an on-chain ERC-8004 reputation write-back: the
   * assignee is an agent with a linked agentId and the review has not been acked.
   * Drained incrementally via the `since` cursor (pass back `nextCursor`). The
   * Coworking API stays fully off-chain; the relayer performs the on-chain write.
   */
  listPendingReputation(
    query: ListPendingReputationQuery = {},
  ): Promise<{ items: PendingReputationItem[]; nextCursor: string | null }> {
    return this.request('GET', `/v1/reputation/pending${toQueryString(query)}`);
  }

  /**
   * Record that a pending reputation review has been handled (idempotent upsert
   * on reviewId). Pass `txHash` after a live giveFeedback; omit it for a dry-run
   * ack. Re-acking the same reviewId is a no-op beyond refreshing the tx hash.
   */
  ackReputation(input: AckReputationInput): Promise<{ ok: boolean; reviewId: string }> {
    return this.request('POST', '/v1/reputation/ack', input);
  }
}
