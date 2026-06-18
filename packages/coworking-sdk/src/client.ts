import type {
  Activity,
  ApiKeyWithSecret,
  Comment,
  Member,
  Project,
  StatusColumn,
  Task,
  TaskDependency,
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

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: number;
  assigneeMemberId?: string;
  parentTaskId?: string;
  dueDate?: string;
  /** Column key to start in; defaults to the project's first column. */
  statusColumnKey?: string;
}

// Type aliases (not interfaces) so they satisfy the Record<string, QueryValue>
// index signature toQueryString expects.
export type ListTasksQuery = {
  projectId?: string;
  status?: string;
  assigneeMemberId?: string;
  limit?: number;
  cursor?: string;
};

export type ActivityQuery = {
  projectId?: string;
  /** ISO timestamp - only activity strictly after this is returned. */
  since?: string;
  limit?: number;
};

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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

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
    const data: unknown = text ? JSON.parse(text) : undefined;

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
}
