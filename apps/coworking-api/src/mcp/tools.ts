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
const b = (description: string) => ({ type: 'boolean', description });
// A free-form object (per-type field bag); accepts any keys.
const obj = (description: string) => ({ type: 'object', description, additionalProperties: true });
// An array of arbitrary items (e.g. acceptance criteria, label ids).
const arr = (description: string, items: Record<string, unknown> = {}) => ({
  type: 'array',
  description,
  items,
});

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
    description: 'List tasks, optionally filtered by project, status column key, assignee, or type.',
    inputSchema: schema({
      projectId: s('Filter by project id'),
      status: s('Filter by status column key, e.g. in_progress'),
      assigneeMemberId: s('Filter by assignee member id'),
      type: s('Filter by task type (generic, code, bug, research, ...)'),
      limit: n('Max results (default 50)'),
    }),
    rest: (a) => ({
      method: 'GET',
      path: `/v1/tasks${query(a, ['projectId', 'status', 'assigneeMemberId', 'type', 'limit'])}`,
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
    description: 'Create a task in a project. Supports the rich task model (type, acceptance criteria, per-type fields, reviewer, labels).',
    inputSchema: schema(
      {
        projectId: s('Project id'),
        title: s('Task title'),
        description: s('Optional description'),
        type: s('Task type (default generic): generic, code, bug, content, design, research, data_analysis, marketing, event, documentation, devops, qa, code_audit, doc_review, translation, education, legal, finance, custom'),
        fields: obj('Per-type advisory field bag - any keys accepted, unknowns never rejected'),
        acceptanceCriteria: arr(
          'Authoritative completion criteria; each item { text, kind?: rule|scenario }',
          { type: 'object', additionalProperties: true },
        ),
        priority: n('0 none, 1 urgent, 2 high, 3 normal, 4 low'),
        statusColumnKey: s('Start column key (default first column)'),
        assigneeMemberId: s('Optional assignee member id'),
        reviewerMemberId: s('Optional accountable reviewer member id'),
        estimateMinutes: n('Optional time estimate in minutes'),
        startDate: s('Optional ISO start date'),
        labelIds: arr('Label ids to attach (each must belong to the project)', { type: 'string' }),
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
        type: a.type,
        fields: a.fields,
        acceptanceCriteria: a.acceptanceCriteria,
        priority: a.priority,
        statusColumnKey: a.statusColumnKey,
        assigneeMemberId: a.assigneeMemberId,
        reviewerMemberId: a.reviewerMemberId,
        estimateMinutes: a.estimateMinutes,
        startDate: a.startDate,
        labelIds: a.labelIds,
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
    inputSchema: schema({ projectId: s('Project id'), type: s('Optional task-type filter') }, ['projectId']),
    rest: (a) => ({
      method: 'GET',
      path: `/v1/projects/${id(a, 'projectId')}/next${query(a, ['type'])}`,
    }),
  },
  {
    name: 'my_reviews',
    description: 'Tasks awaiting the calling agent\'s review verdict (the reviewer inbox), ordered by priority.',
    inputSchema: schema({ type: s('Optional task-type filter') }),
    rest: (a) => ({ method: 'GET', path: `/v1/me/reviews${query(a, ['type'])}` }),
  },
  {
    name: 'list_templates',
    description: 'List reusable task templates. Without projectId, returns workspace-wide templates; with it, also that project\'s own templates.',
    inputSchema: schema({ projectId: s('Optional project id to include project-scoped templates') }),
    rest: (a) => ({ method: 'GET', path: `/v1/templates${query(a, ['projectId'])}` }),
  },
  {
    name: 'create_task_from_template',
    description: 'Instantiate a task in a project from a template. `vars` fill {{placeholders}}; `fields` override per-type defaults.',
    inputSchema: schema(
      {
        templateId: s('Template id'),
        projectId: s('Target project id'),
        title: s('Optional title override (defaults to the template name)'),
        priority: n('Optional priority override (0-4)'),
        statusColumnKey: s('Optional start column key'),
        assigneeMemberId: s('Optional assignee member id'),
        reviewerMemberId: s('Optional reviewer member id'),
        vars: obj('{{placeholder}} substitutions for the template body and AC'),
        fields: obj('Per-type field overrides merged onto the template defaults'),
      },
      ['templateId', 'projectId'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/from-template/${id(a, 'templateId')}`,
      body: {
        projectId: a.projectId,
        title: a.title,
        priority: a.priority,
        statusColumnKey: a.statusColumnKey,
        assigneeMemberId: a.assigneeMemberId,
        reviewerMemberId: a.reviewerMemberId,
        vars: a.vars,
        fields: a.fields,
      },
    }),
  },
  {
    name: 'request_review',
    description: 'Move a task into review. Reviewer resolves explicit > existing > assignee; an in-review column is found or created unless statusColumnKey overrides it.',
    inputSchema: schema(
      {
        taskId: s('Task id'),
        reviewerMemberId: s('Optional reviewer member id'),
        statusColumnKey: s('Optional review column key override'),
      },
      ['taskId'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/${id(a, 'taskId')}/request-review`,
      body: { reviewerMemberId: a.reviewerMemberId, statusColumnKey: a.statusColumnKey },
    }),
  },
  {
    name: 'submit_review',
    description: 'Record a review verdict. approved -> done column; changes_requested -> back to an in-progress column; rejected -> canceled.',
    inputSchema: schema(
      {
        taskId: s('Task id'),
        verdict: s('approved | changes_requested | rejected'),
        comment: s('Optional review comment'),
        score: n('Optional 1-5 quality score'),
      },
      ['taskId', 'verdict'],
    ),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/${id(a, 'taskId')}/review`,
      body: { verdict: a.verdict, comment: a.comment, score: a.score },
    }),
  },
  {
    name: 'add_watcher',
    description: 'Add a watcher to a task (the RACI "Informed" set). Defaults to the calling agent when memberId is omitted.',
    inputSchema: schema({ taskId: s('Task id'), memberId: s('Optional member id (default: caller)') }, ['taskId']),
    rest: (a) => ({
      method: 'POST',
      path: `/v1/tasks/${id(a, 'taskId')}/watchers`,
      body: { memberId: a.memberId },
    }),
  },
  {
    name: 'remove_watcher',
    description: 'Remove a watcher from a task.',
    inputSchema: schema({ taskId: s('Task id'), memberId: s('Member id to remove') }, ['taskId', 'memberId']),
    rest: (a) => ({
      method: 'DELETE',
      path: `/v1/tasks/${id(a, 'taskId')}/watchers/${id(a, 'memberId')}`,
    }),
  },
  {
    name: 'list_labels',
    description: 'List the labels defined in a project.',
    inputSchema: schema({ projectId: s('Project id') }, ['projectId']),
    rest: (a) => ({ method: 'GET', path: `/v1/projects/${id(a, 'projectId')}/labels` }),
  },
  {
    name: 'list_unmet_criteria',
    description: 'Read a task so the agent can inspect its unmet acceptance-criteria and Definition-of-Done items (those with done=false in acceptanceCriteria / definitionOfDone).',
    inputSchema: schema({ taskId: s('Task id') }, ['taskId']),
    rest: (a) => ({ method: 'GET', path: `/v1/tasks/${id(a, 'taskId')}` }),
  },
  {
    // Non-destructive preview ONLY. The destructive commit/clear/seed paths are
    // deliberately REST-only and are never exposed over MCP.
    name: 'preview_reset',
    description: 'Dry-run a project or workspace reset: returns the soft-delete counts and a confirmation token WITHOUT deleting anything. The destructive commit is REST-only and not available via MCP.',
    inputSchema: schema({ projectId: s('Project id to preview a project reset; omit to preview a full workspace clear') }),
    rest: (a) => ({
      method: 'POST',
      path: a.projectId ? `/v1/projects/${id(a, 'projectId')}/reset` : '/v1/workspaces/current/reset',
      body: { dryRun: true },
    }),
  },
];
