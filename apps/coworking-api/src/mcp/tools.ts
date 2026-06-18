// MCP tool catalogue. Each tool maps to an internal REST call so the MCP server
// stays a thin translation layer over the same logic the HTTP API uses.

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  rest: (args: Record<string, unknown>) => { method: string; path: string; body?: unknown };
}

const s = (description: string) => ({ type: 'string', description });
const n = (description: string) => ({ type: 'number', description });

function schema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false };
}

function query(args: Record<string, unknown>, keys: string[]): string {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = args[key];
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const id = (args: Record<string, unknown>, key: string): string => String(args[key] ?? '');

export const TOOLS: McpTool[] = [
  {
    name: 'list_projects',
    description: 'List all projects in the workspace.',
    inputSchema: schema({}),
    rest: () => ({ method: 'GET', path: '/v1/projects' }),
  },
  {
    name: 'get_project',
    description: 'Get a single project by id.',
    inputSchema: schema({ projectId: s('Project id') }, ['projectId']),
    rest: (a) => ({ method: 'GET', path: `/v1/projects/${id(a, 'projectId')}` }),
  },
  {
    name: 'create_project',
    description: 'Create a project. Seeds a default board (backlog, to do, in progress, in review, done, canceled).',
    inputSchema: schema(
      { key: s('Short project key, e.g. CORE'), name: s('Project name'), description: s('Optional description') },
      ['key', 'name'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: '/v1/projects',
      body: { key: a.key, name: a.name, description: a.description },
    }),
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by project, status column key, or assignee.',
    inputSchema: schema({
      projectId: s('Filter by project id'),
      status: s('Filter by status column key, e.g. in_progress'),
      assigneeMemberId: s('Filter by assignee member id'),
      limit: n('Max results (default 50)'),
    }),
    rest: (a) => ({
      method: 'GET',
      path: `/v1/tasks${query(a, ['projectId', 'status', 'assigneeMemberId', 'limit'])}`,
    }),
  },
  {
    name: 'get_task',
    description: 'Get a single task by id.',
    inputSchema: schema({ taskId: s('Task id') }, ['taskId']),
    rest: (a) => ({ method: 'GET', path: `/v1/tasks/${id(a, 'taskId')}` }),
  },
  {
    name: 'create_task',
    description: 'Create a task in a project.',
    inputSchema: schema(
      {
        projectId: s('Project id'),
        title: s('Task title'),
        description: s('Optional description'),
        priority: n('0 none, 1 urgent, 2 high, 3 normal, 4 low'),
        statusColumnKey: s('Start column key (default first column)'),
        assigneeMemberId: s('Optional assignee member id'),
      },
      ['projectId', 'title'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: '/v1/tasks',
      body: {
        projectId: a.projectId,
        title: a.title,
        description: a.description,
        priority: a.priority,
        statusColumnKey: a.statusColumnKey,
        assigneeMemberId: a.assigneeMemberId,
      },
    }),
  },
  {
    name: 'update_task_status',
    description: 'Move a task to a different board column (by column key).',
    inputSchema: schema(
      { taskId: s('Task id'), statusColumnKey: s('Target column key, e.g. done') },
      ['taskId', 'statusColumnKey'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/${id(a, 'taskId')}/status`,
      body: { statusColumnKey: a.statusColumnKey },
    }),
  },
  {
    name: 'claim_task',
    description: 'Claim a task - assigns it to the calling agent if unassigned.',
    inputSchema: schema({ taskId: s('Task id') }, ['taskId']),
    rest: (a) => ({ method: 'POST', path: `/v1/tasks/${id(a, 'taskId')}/claim` }),
  },
  {
    name: 'assign_task',
    description: 'Assign a task to a specific member.',
    inputSchema: schema(
      { taskId: s('Task id'), memberId: s('Member id to assign') },
      ['taskId', 'memberId'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/${id(a, 'taskId')}/assign`,
      body: { memberId: a.memberId },
    }),
  },
  {
    name: 'add_comment',
    description: 'Add a comment to a task (the per-task channel between agents).',
    inputSchema: schema({ taskId: s('Task id'), body: s('Comment text') }, ['taskId', 'body']),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/${id(a, 'taskId')}/comments`,
      body: { body: a.body },
    }),
  },
  {
    name: 'add_dependency',
    description: 'Declare that a task is blocked by another task.',
    inputSchema: schema(
      {
        taskId: s('The blocked task id'),
        blockerTaskId: s('The task that must finish first'),
        type: s('blocks | relates_to | duplicates (default blocks)'),
      },
      ['taskId', 'blockerTaskId'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/${id(a, 'taskId')}/dependencies`,
      body: { blockerTaskId: a.blockerTaskId, type: a.type },
    }),
  },
  {
    name: 'list_members',
    description: 'List members (agents and humans) in the workspace.',
    inputSchema: schema({}),
    rest: () => ({ method: 'GET', path: '/v1/members' }),
  },
  {
    name: 'get_activity',
    description: 'Read the workspace activity feed (the blackboard). Use `since` to poll for changes.',
    inputSchema: schema({
      projectId: s('Filter by project id'),
      since: s('ISO timestamp - only activity after this'),
      limit: n('Max results (default 50)'),
    }),
    rest: (a) => ({ method: 'GET', path: `/v1/activity${query(a, ['projectId', 'since', 'limit'])}` }),
  },
  {
    name: 'my_open_tasks',
    description: 'Tasks assigned to the calling agent that are not done yet, ordered by priority.',
    inputSchema: schema({}),
    rest: () => ({ method: 'GET', path: '/v1/me/tasks' }),
  },
  {
    name: 'whats_blocking_me',
    description: 'The calling agent\'s open tasks that are blocked, with their unfinished blockers.',
    inputSchema: schema({}),
    rest: () => ({ method: 'GET', path: '/v1/me/blocked' }),
  },
  {
    name: 'whats_next',
    description: 'Tasks in a project that are ready to start now (unblocked, actionable), ordered by priority.',
    inputSchema: schema({ projectId: s('Project id') }, ['projectId']),
    rest: (a) => ({ method: 'GET', path: `/v1/projects/${id(a, 'projectId')}/next` }),
  },
];
