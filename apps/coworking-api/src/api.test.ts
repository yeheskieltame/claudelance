// Integration tests over the full HTTP surface, backed by an in-memory pglite
// Postgres so they run anywhere with no external database.

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Hono } from 'hono';

import type { CoworkingConfig } from './config.js';
import type { Database } from './db/client.js';
import * as schema from './db/schema.js';
import type { AppEnv } from './lib/context.js';
import { createServer } from './server.js';
import { deliverPending } from './services/webhooks.js';

interface Harness {
  app: Hono<AppEnv>;
  client: PGlite;
  db: Database;
}

async function setup(): Promise<Harness> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });
  const cfg: CoworkingConfig = {
    databaseUrl: 'pglite',
    port: 0,
    nodeEnv: 'test',
    migrateOnStart: false,
  };
  // pglite + postgres-js share the same Drizzle query API; the cast is test-only.
  const dbHandle = db as unknown as Database;
  const app = createServer({ db: dbHandle, cfg });
  return { app, client, db: dbHandle };
}

interface CallResult {
  status: number;
  // Test-only dynamic JSON; loose typing keeps assertions terse.
  body: any;
}

async function call(
  app: Hono<AppEnv>,
  method: string,
  path: string,
  body?: unknown,
  key?: string,
): Promise<CallResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await app.request(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

test('coworking end-to-end: bootstrap -> project -> task -> coordinate -> activity', async () => {
  const { app, client } = await setup();
  try {
    const health = await call(app, 'GET', '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);

    // Bootstrap a workspace; the owner API key is returned once.
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Agent Team', ownerName: 'Lead' });
    assert.equal(boot.status, 201);
    assert.equal(boot.body.workspace.slug, 'agent-team');
    const key: string = boot.body.apiKey.key;
    assert.ok(key.startsWith('cwk_'));
    assert.equal(boot.body.owner.role, 'owner');

    // No key -> 401.
    const noAuth = await call(app, 'GET', '/v1/projects');
    assert.equal(noAuth.status, 401);

    // Bad key -> 401.
    const badAuth = await call(app, 'GET', '/v1/projects', undefined, 'cwk_nope');
    assert.equal(badAuth.status, 401);

    // Create a project; it auto-seeds the 6 default board columns.
    const project = await call(app, 'POST', '/v1/projects', { key: 'CORE', name: 'Core work' }, key);
    assert.equal(project.status, 201);
    const projectId: string = project.body.id;

    const cols = await call(app, 'GET', `/v1/projects/${projectId}/columns`, undefined, key);
    assert.equal(cols.body.items.length, 6);
    assert.equal(cols.body.items[0].key, 'backlog');
    assert.equal(cols.body.items[4].category, 'completed');

    // Duplicate project key -> 409.
    const dupe = await call(app, 'POST', '/v1/projects', { key: 'CORE', name: 'Dup' }, key);
    assert.equal(dupe.status, 409);

    // Create a task; first task in a project is number 1.
    const task = await call(app, 'POST', '/v1/tasks', { projectId, title: 'Ship the parser' }, key);
    assert.equal(task.status, 201);
    assert.equal(task.body.number, 1);
    const taskId: string = task.body.id;

    // Claim assigns it to the caller.
    const claim = await call(app, 'POST', `/v1/tasks/${taskId}/claim`, undefined, key);
    assert.equal(claim.status, 200);
    assert.ok(claim.body.assigneeMemberId);

    const comment = await call(app, 'POST', `/v1/tasks/${taskId}/comments`, { body: 'starting now' }, key);
    assert.equal(comment.status, 201);

    // Move to done -> completedAt is set + emits task.completed.
    const done = await call(app, 'POST', `/v1/tasks/${taskId}/status`, { statusColumnKey: 'done' }, key);
    assert.equal(done.status, 200);
    assert.ok(done.body.completedAt);

    // Second task, then a dependency: task2 is blocked by task1.
    const task2 = await call(app, 'POST', '/v1/tasks', { projectId, title: 'Write tests' }, key);
    assert.equal(task2.body.number, 2);
    const dep = await call(
      app,
      'POST',
      `/v1/tasks/${task2.body.id}/dependencies`,
      { blockerTaskId: taskId },
      key,
    );
    assert.equal(dep.status, 201);

    // The blackboard recorded the whole story.
    const activity = await call(app, 'GET', '/v1/activity', undefined, key);
    const verbs: string[] = activity.body.items.map((a: { verb: string }) => a.verb);
    for (const expected of [
      'workspace.created',
      'project.created',
      'task.created',
      'task.claimed',
      'comment.added',
      'task.status_changed',
      'task.completed',
      'dependency.added',
    ]) {
      assert.ok(verbs.includes(expected), `expected activity verb ${expected}`);
    }

    // Listing returns both tasks; status filter narrows to done.
    const all = await call(app, 'GET', `/v1/tasks?projectId=${projectId}`, undefined, key);
    assert.equal(all.body.items.length, 2);
    const doneOnly = await call(app, 'GET', `/v1/tasks?projectId=${projectId}&status=done`, undefined, key);
    assert.equal(doneOnly.body.items.length, 1);
    assert.equal(doneOnly.body.items[0].id, taskId);
  } finally {
    await client.close();
  }
});

test('mcp server: initialize, tools/list, tools/call bridges to REST', async () => {
  const { app, client } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'MCP Team' });
    const key: string = boot.body.apiKey.key;

    // initialize + tools/list are open for discovery.
    const init = await call(app, 'POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal(init.status, 200);
    assert.equal(init.body.result.serverInfo.name, 'claudelance-coworking');
    assert.equal(init.body.result.protocolVersion, '2024-11-05');

    const list = await call(app, 'POST', '/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const names: string[] = list.body.result.tools.map((t: { name: string }) => t.name);
    for (const expected of ['create_project', 'create_task', 'claim_task', 'whats_next', 'my_open_tasks', 'get_activity']) {
      assert.ok(names.includes(expected), `tools/list should include ${expected}`);
    }

    // tools/call create_project -> bridges to POST /v1/projects.
    const cp = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'create_project', arguments: { key: 'CORE', name: 'Core' } },
    }, key);
    assert.equal(cp.body.result.isError, false);
    const project = JSON.parse(cp.body.result.content[0].text);
    assert.equal(project.key, 'CORE');

    // create + claim a task through MCP.
    const ct = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'create_task', arguments: { projectId: project.id, title: 'Do the thing', priority: 1 } },
    }, key);
    const taskCreated = JSON.parse(ct.body.result.content[0].text);
    assert.equal(taskCreated.number, 1);

    const claimed = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'claim_task', arguments: { taskId: taskCreated.id } },
    }, key);
    assert.equal(claimed.body.result.isError, false);

    // Coordination tools run their alias queries without error.
    const next = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'whats_next', arguments: { projectId: project.id } },
    }, key);
    assert.equal(next.body.result.isError, false);
    const nextItems = JSON.parse(next.body.result.content[0].text);
    assert.ok(Array.isArray(nextItems.items));

    const mine = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'my_open_tasks', arguments: {} },
    }, key);
    const mineItems = JSON.parse(mine.body.result.content[0].text);
    assert.equal(mineItems.items.length, 1);
    assert.equal(mineItems.items[0].id, taskCreated.id);

    const blocked = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'whats_blocking_me', arguments: {} },
    }, key);
    assert.equal(blocked.body.result.isError, false);

    // Unknown tool -> JSON-RPC error.
    const bad = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'no_such_tool', arguments: {} },
    }, key);
    assert.ok(bad.body.error);
    assert.equal(bad.body.error.code, -32602);

    // A tools/call without a key bridges to REST and surfaces a 401 as isError.
    const unauth = await call(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'list_projects', arguments: {} },
    });
    assert.equal(unauth.body.result.isError, true);
  } finally {
    await client.close();
  }
});

test('task-model-v2 P4: MCP tools + label endpoints; destructive reset stays REST-only', async () => {
  const { app, client } = await setup();
  const mcp = (id: number, name: string, args: Record<string, unknown>, key?: string) =>
    call(app, 'POST', '/mcp', { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, key);
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'P4 Team' });
    const key: string = boot.body.apiKey.key;
    const ownerId: string = boot.body.owner.id;
    const project = (await call(app, 'POST', '/v1/projects', { key: 'P4', name: 'P4' }, key)).body;

    // tools/list advertises the new P4 tools but NOT any destructive reset tool.
    const list = await call(app, 'POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names: string[] = list.body.result.tools.map((t: { name: string }) => t.name);
    for (const expected of [
      'list_templates', 'create_task_from_template', 'request_review', 'submit_review',
      'add_watcher', 'remove_watcher', 'list_unmet_criteria', 'my_reviews', 'list_labels', 'preview_reset',
    ]) {
      assert.ok(names.includes(expected), `tools/list should include ${expected}`);
    }
    for (const forbidden of ['commit_reset', 'reset_project', 'clear_workspace', 'seed_demo']) {
      assert.ok(!names.includes(forbidden), `tools/list must NOT expose ${forbidden}`);
    }

    // Label REST endpoints back the SDK/MCP label surface.
    const label = (await call(app, 'POST', `/v1/projects/${project.id}/labels`, { name: 'backend', color: '#0af' }, key)).body;
    assert.equal(label.name, 'backend');
    const dupe = await call(app, 'POST', `/v1/projects/${project.id}/labels`, { name: 'backend' }, key);
    assert.equal(dupe.status, 409); // label_name_taken
    const labelList = await mcp(2, 'list_labels', { projectId: project.id }, key);
    assert.equal(JSON.parse(labelList.body.result.content[0].text).items.length, 1);

    // create_task via MCP with the rich fields, then PUT /tasks/:id/labels.
    const ct = await mcp(3, 'create_task', {
      projectId: project.id,
      title: 'Rich task',
      type: 'code',
      acceptanceCriteria: [{ text: 'compiles' }, { text: 'tests pass' }],
      fields: { repo: 'acme/widgets' },
    }, key);
    const task = JSON.parse(ct.body.result.content[0].text);
    assert.equal(task.type, 'code');
    assert.equal(task.acceptanceCriteria.length, 2);
    assert.equal((task.fields as { repo: string }).repo, 'acme/widgets');

    const setLabels = await call(app, 'PUT', `/v1/tasks/${task.id}/labels`, { labelIds: [label.id] }, key);
    assert.equal(setLabels.status, 200);
    assert.equal(setLabels.body.labels[0].id, label.id);
    // A label from another project is rejected.
    const other = (await call(app, 'POST', '/v1/projects', { key: 'OTHER', name: 'Other' }, key)).body;
    const foreign = (await call(app, 'POST', `/v1/projects/${other.id}/labels`, { name: 'x' }, key)).body;
    const badSet = await call(app, 'PUT', `/v1/tasks/${task.id}/labels`, { labelIds: [foreign.id] }, key);
    assert.equal(badSet.status, 400);

    // list_unmet_criteria returns the task so the agent can read unmet AC.
    const unmet = await mcp(4, 'list_unmet_criteria', { taskId: task.id }, key);
    const unmetTask = JSON.parse(unmet.body.result.content[0].text);
    assert.equal(unmetTask.acceptanceCriteria.filter((c: { done: boolean }) => !c.done).length, 2);

    // add_watcher (defaults to caller), then request_review + submit_review loop.
    const watch = await mcp(5, 'add_watcher', { taskId: task.id }, key);
    assert.equal(watch.body.result.isError, false);
    const rr = await mcp(6, 'request_review', { taskId: task.id, reviewerMemberId: ownerId }, key);
    assert.equal(rr.body.result.isError, false);
    assert.equal(JSON.parse(rr.body.result.content[0].text).reviewerMemberId, ownerId);
    const myReviews = await mcp(7, 'my_reviews', {}, key);
    assert.equal(JSON.parse(myReviews.body.result.content[0].text).items.length, 1);
    const sr = await mcp(8, 'submit_review', { taskId: task.id, verdict: 'approved', score: 5 }, key);
    assert.equal(sr.body.result.isError, false);

    // list_templates surfaces the seeded builtins; create_task_from_template works.
    const tmpls = await mcp(9, 'list_templates', {}, key);
    const tmplItems = JSON.parse(tmpls.body.result.content[0].text).items as Array<{ id: string; builtin: boolean }>;
    assert.ok(tmplItems.length >= 1 && tmplItems.every((t) => t.builtin));
    const fromTmpl = await mcp(10, 'create_task_from_template', { templateId: tmplItems[0]!.id, projectId: project.id }, key);
    assert.equal(fromTmpl.body.result.isError, false);

    // preview_reset is a pure dry-run: returns counts + token, deletes nothing.
    const preview = await mcp(11, 'preview_reset', { projectId: project.id }, key);
    assert.equal(preview.body.result.isError, false);
    const pv = JSON.parse(preview.body.result.content[0].text);
    assert.ok(typeof pv.confirmationToken === 'string' && pv.confirmationToken.length > 0);
    assert.equal(pv.scope, 'project');
    const stillThere = await call(app, 'GET', `/v1/tasks/${task.id}`, undefined, key);
    assert.equal(stillThere.status, 200);
    assert.equal(stillThere.body.trashedAt, null); // dry-run did not delete
  } finally {
    await client.close();
  }
});

test('time tracking and goal progress roll-up', async () => {
  const { app, client } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Depth Team' });
    const key: string = boot.body.apiKey.key;
    const project = (await call(app, 'POST', '/v1/projects', { key: 'D', name: 'Depth' }, key)).body;
    const task = (await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'Build it' }, key)).body;

    // Timer: check-in is idempotent while open, check-out closes it with a duration.
    const ci = await call(app, 'POST', `/v1/tasks/${task.id}/check-in`, undefined, key);
    assert.equal(ci.status, 201);
    assert.equal(ci.body.endedAt, null);
    const ciAgain = await call(app, 'POST', `/v1/tasks/${task.id}/check-in`, undefined, key);
    assert.equal(ciAgain.body.id, ci.body.id);
    const co = await call(app, 'POST', `/v1/tasks/${task.id}/check-out`, undefined, key);
    assert.equal(co.status, 200);
    assert.notEqual(co.body.durationSeconds, null);

    // Manual log adds 30 minutes.
    const log = await call(app, 'POST', `/v1/tasks/${task.id}/time`, { minutes: 30, note: 'pairing' }, key);
    assert.equal(log.status, 201);
    assert.equal(log.body.durationSeconds, 1800);
    const sheet = await call(app, 'GET', `/v1/tasks/${task.id}/time`, undefined, key);
    assert.ok(sheet.body.totalSeconds >= 1800);

    // Goal linked to the task: progress tracks the task's completion.
    const goal = (await call(app, 'POST', '/v1/goals', { name: 'Ship v1' }, key)).body;
    assert.equal(goal.progress, 0);
    await call(app, 'POST', `/v1/goals/${goal.id}/links`, { taskId: task.id }, key);
    let fetched = (await call(app, 'GET', `/v1/goals/${goal.id}`, undefined, key)).body;
    assert.equal(fetched.progress, 0); // task not done yet
    assert.equal(fetched.links.length, 1);
    await call(app, 'POST', `/v1/tasks/${task.id}/status`, { statusColumnKey: 'done' }, key);
    fetched = (await call(app, 'GET', `/v1/goals/${goal.id}`, undefined, key)).body;
    assert.equal(fetched.progress, 1); // linked task completed -> 100%

    await call(app, 'PATCH', `/v1/goals/${goal.id}`, { currentValue: 5, status: 'on_track' }, key);
    const verbs: string[] = (await call(app, 'GET', '/v1/activity', undefined, key)).body.items.map(
      (a: { verb: string }) => a.verb,
    );
    for (const expected of ['goal.created', 'goal.progressed', 'time.checked_in', 'time.checked_out']) {
      assert.ok(verbs.includes(expected), `expected activity verb ${expected}`);
    }
  } finally {
    await client.close();
  }
});

test('automation fires on status change; webhook delivers matching activity', async () => {
  const { app, client, db } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Auto Team' });
    const key: string = boot.body.apiKey.key;
    const project = (await call(app, 'POST', '/v1/projects', { key: 'A', name: 'Auto' }, key)).body;

    // Rule: when a task moves to "done", auto-comment on it.
    const automation = await call(
      app,
      'POST',
      `/v1/projects/${project.id}/automations`,
      {
        name: 'celebrate done',
        trigger: { event: 'task.status_changed', to: 'done' },
        action: { type: 'add_comment', body: 'Auto: nice work!' },
      },
      key,
    );
    assert.equal(automation.status, 201);

    const task = (await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'Finish me' }, key)).body;
    await call(app, 'POST', `/v1/tasks/${task.id}/status`, { statusColumnKey: 'done' }, key);

    // Engine added the comment and logged automation.fired.
    const comments = await call(app, 'GET', `/v1/tasks/${task.id}/comments`, undefined, key);
    assert.ok(comments.body.items.some((cm: { body: string }) => cm.body === 'Auto: nice work!'));
    const verbs: string[] = (await call(app, 'GET', '/v1/activity', undefined, key)).body.items.map(
      (a: { verb: string }) => a.verb,
    );
    assert.ok(verbs.includes('automation.fired'));

    // Webhook subscribed to task.created: deliver and verify the signed POST.
    await call(app, 'POST', '/v1/webhooks', { url: 'https://example.test/hook', events: ['task.created'] }, key);
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const mockFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    await deliverPending(db, mockFetch, new Date(0));
    const delivered = calls.find((cc) => cc.headers['x-coworking-event'] === 'task.created');
    assert.ok(delivered, 'expected a task.created webhook delivery');
    assert.equal(delivered!.url, 'https://example.test/hook');
    assert.ok(delivered!.headers['x-coworking-signature']?.startsWith('sha256='));
  } finally {
    await client.close();
  }
});

test('premium gating: free tier caps projects, premium is unlimited', async () => {
  const { app, client, db } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Cap Team' });
    const key: string = boot.body.apiKey.key;
    const workspaceId: string = boot.body.workspace.id;

    // Free tier allows up to 3 projects (the default cap).
    for (let i = 1; i <= 3; i++) {
      const r = await call(app, 'POST', '/v1/projects', { key: `P${i}`, name: `Project ${i}` }, key);
      assert.equal(r.status, 201);
    }
    const blocked = await call(app, 'POST', '/v1/projects', { key: 'P4', name: 'Project 4' }, key);
    assert.equal(blocked.status, 402);
    assert.equal(blocked.body.error.code, 'premium_required');

    // Flipping is_premium lifts the cap.
    await db.update(schema.workspaces).set({ isPremium: true }).where(eq(schema.workspaces.id, workspaceId));
    const ok = await call(app, 'POST', '/v1/projects', { key: 'P4', name: 'Project 4' }, key);
    assert.equal(ok.status, 201);
  } finally {
    await client.close();
  }
});

test('task-model-v2: templates, AC/DoD, review back-edge, watchers, trash, authz', async () => {
  const { app, client } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'V2 Team', ownerName: 'Lead' });
    const key: string = boot.body.apiKey.key;
    const ownerMemberId: string = boot.body.owner.id;

    // Bootstrap seeds the builtin templates (one per meaningful type).
    const templates = await call(app, 'GET', '/v1/templates', undefined, key);
    assert.equal(templates.status, 200);
    assert.ok(templates.body.items.length >= 15, 'expected builtin templates to be seeded');
    const codeTpl = templates.body.items.find((t: { taskType: string }) => t.taskType === 'code');
    assert.ok(codeTpl, 'expected a builtin code template');
    const legalTpl = templates.body.items.find((t: { taskType: string }) => t.taskType === 'legal');
    assert.ok(
      legalTpl.acceptanceCriteria.some((ac: { text: string }) => /disclaimer/i.test(ac.text)),
      'legal template must carry a disclaimer AC item',
    );
    assert.equal(codeTpl.builtin, true);

    // Owner-only PATCH /workspace sets the DoD template; new tasks snapshot it.
    const patchWs = await call(
      app,
      'PATCH',
      '/v1/workspace',
      { definitionOfDone: [{ text: 'CI green' }, { text: 'Docs updated' }] },
      key,
    );
    assert.equal(patchWs.status, 200);
    assert.equal(patchWs.body.definitionOfDone.length, 2);

    const project = (await call(app, 'POST', '/v1/projects', { key: 'V2', name: 'V2' }, key)).body;

    // Column management is admin-gated; the owner passes.
    const addCol = await call(
      app,
      'POST',
      `/v1/projects/${project.id}/columns`,
      { key: 'extra', name: 'Extra' },
      key,
    );
    assert.equal(addCol.status, 201);

    // A typed task with acceptance criteria + an advisory field bag.
    const richTask = await call(
      app,
      'POST',
      '/v1/tasks',
      {
        projectId: project.id,
        title: 'Implement parser',
        type: 'code',
        fields: { repo: 'acme/parser', anything: 123 }, // unknown keys accepted
        acceptanceCriteria: [{ text: 'Handles empty input' }, { kind: 'scenario', text: 'Given X when Y then Z' }],
        acceptanceNotes: 'see RFC',
      },
      key,
    );
    assert.equal(richTask.status, 201);
    assert.equal(richTask.body.type, 'code');
    assert.equal(richTask.body.acceptanceCriteria.length, 2);
    assert.equal(richTask.body.acceptanceCriteria[0].done, false);
    assert.ok(richTask.body.acceptanceCriteria[0].id, 'AC items get server ids');
    assert.equal(richTask.body.definitionOfDone.length, 2, 'workspace DoD is snapshotted');
    assert.deepEqual(richTask.body.fields, { repo: 'acme/parser', anything: 123 });
    const taskId: string = richTask.body.id;

    // Reporter auto-watches; the list view inlines labels + AC progress.
    const watchers = await call(app, 'GET', `/v1/tasks/${taskId}/watchers`, undefined, key);
    assert.ok(watchers.body.items.some((w: { memberId: string }) => w.memberId === ownerMemberId));

    const list = await call(app, 'GET', `/v1/tasks?projectId=${project.id}&type=code`, undefined, key);
    assert.equal(list.body.items.length, 1);
    assert.deepEqual(list.body.items[0].acProgress, { done: 0, total: 4 }); // 2 AC + 2 DoD

    // Review loop: request-review moves to in_review; changes_requested moves back.
    const rr = await call(app, 'POST', `/v1/tasks/${taskId}/request-review`, undefined, key);
    assert.equal(rr.status, 200);
    const inReview = (await call(app, 'GET', `/v1/tasks/${taskId}`, undefined, key)).body.statusColumnId;
    const review = await call(
      app,
      'POST',
      `/v1/tasks/${taskId}/review`,
      { verdict: 'changes_requested', comment: 'fix edge case', score: 3 },
      key,
    );
    assert.equal(review.status, 201);
    assert.equal(review.body.verdict, 'changes_requested');
    const afterReview = (await call(app, 'GET', `/v1/tasks/${taskId}`, undefined, key)).body.statusColumnId;
    assert.notEqual(afterReview, inReview, 'changes_requested moves the task back off the review column');

    // Move to done with unmet AC/DoD -> WARNs (comment + activity) but does NOT block.
    const done = await call(app, 'POST', `/v1/tasks/${taskId}/status`, { statusColumnKey: 'done' }, key);
    assert.equal(done.status, 200);
    assert.ok(done.body.completedAt, 'task still closes despite unmet criteria');
    const comments = await call(app, 'GET', `/v1/tasks/${taskId}/comments`, undefined, key);
    assert.ok(
      comments.body.items.some((cm: { body: string }) => /unmet/i.test(cm.body)),
      'a warning comment is posted on completing with unmet criteria',
    );

    // Instantiate a task from the code builtin; its AC is materialized fresh.
    const fromTpl = await call(
      app,
      'POST',
      `/v1/tasks/from-template/${codeTpl.id}`,
      { projectId: project.id, vars: { goal: 'build the thing' } },
      key,
    );
    assert.equal(fromTpl.status, 201);
    assert.equal(fromTpl.body.type, 'code');
    assert.ok(fromTpl.body.acceptanceCriteria.length >= 1);
    assert.ok(fromTpl.body.description.includes('build the thing'), 'placeholder substituted');

    // Soft-delete (trash) removes the task from the default list; restore brings it back.
    const trash = await call(app, 'DELETE', `/v1/tasks/${taskId}`, undefined, key);
    assert.equal(trash.status, 200);
    assert.ok(trash.body.trashedAt);
    const afterTrash = await call(app, 'GET', `/v1/tasks?projectId=${project.id}`, undefined, key);
    assert.ok(!afterTrash.body.items.some((t: { id: string }) => t.id === taskId), 'trashed task is hidden');
    await call(app, 'POST', `/v1/tasks/${taskId}/restore`, undefined, key);
    const afterRestore = await call(app, 'GET', `/v1/tasks?projectId=${project.id}`, undefined, key);
    assert.ok(afterRestore.body.items.some((t: { id: string }) => t.id === taskId), 'restored task reappears');

    // authz: a viewer (read-scoped key) may read + comment but not create tasks.
    const viewer = (
      await call(app, 'POST', '/v1/members', { displayName: 'Watcher', role: 'viewer' }, key)
    ).body;
    const viewerKey: string = (
      await call(app, 'POST', '/v1/keys', { memberId: viewer.id, scopes: ['read'] }, key)
    ).body.key;
    const denied = await call(
      app,
      'POST',
      '/v1/tasks',
      { projectId: project.id, title: 'nope' },
      viewerKey,
    );
    assert.equal(denied.status, 403);
    const canComment = await call(app, 'POST', `/v1/tasks/${taskId}/comments`, { body: 'lgtm' }, viewerKey);
    assert.equal(canComment.status, 201, 'viewers may comment');
    const canRead = await call(app, 'GET', `/v1/tasks?projectId=${project.id}`, undefined, viewerKey);
    assert.equal(canRead.status, 200, 'viewers may read');
  } finally {
    await client.close();
  }
});

test('task-model-v2 review loop: roles, verdict moves, reviewer authz, /me/reviews', async () => {
  const { app, client } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Review Team', ownerName: 'Lead' });
    const ownerKey: string = boot.body.apiKey.key;

    // A second member (role=member) who will be the reviewer, with their own key.
    const reviewer = (
      await call(app, 'POST', '/v1/members', { displayName: 'Reviewer', role: 'member' }, ownerKey)
    ).body;
    const reviewerKey: string = (
      await call(app, 'POST', '/v1/keys', { memberId: reviewer.id, scopes: ['read', 'write'] }, ownerKey)
    ).body.key;
    // A third, unrelated member who must NOT be able to review someone else's task.
    const stranger = (
      await call(app, 'POST', '/v1/members', { displayName: 'Stranger', role: 'member' }, ownerKey)
    ).body;
    const strangerKey: string = (
      await call(app, 'POST', '/v1/keys', { memberId: stranger.id, scopes: ['read', 'write'] }, ownerKey)
    ).body.key;

    const project = (await call(app, 'POST', '/v1/projects', { key: 'RV', name: 'Review' }, ownerKey)).body;

    // The reviewer claims a task -> auto-watches as the assignee (Responsible).
    const task = (
      await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'Approve me' }, ownerKey)
    ).body;
    await call(app, 'POST', `/v1/tasks/${task.id}/claim`, undefined, reviewerKey);
    const watchers = (await call(app, 'GET', `/v1/tasks/${task.id}/watchers`, undefined, ownerKey)).body;
    assert.ok(
      watchers.items.some((w: { memberId: string }) => w.memberId === reviewer.id),
      'claiming auto-adds the assignee as a watcher',
    );

    // request-review assigns an explicit reviewer + moves to a started column.
    const rr = await call(
      app,
      'POST',
      `/v1/tasks/${task.id}/request-review`,
      { reviewerMemberId: reviewer.id },
      ownerKey,
    );
    assert.equal(rr.status, 200);
    assert.equal(rr.body.reviewerMemberId, reviewer.id, 'reviewer is set by request-review');
    const inReviewColId: string = rr.body.statusColumnId;

    // The task now shows up in the reviewer's /me/reviews inbox (but not the stranger's).
    const myReviews = await call(app, 'GET', '/v1/me/reviews', undefined, reviewerKey);
    assert.equal(myReviews.status, 200);
    assert.ok(
      myReviews.body.items.some((t: { id: string }) => t.id === task.id),
      'awaiting-review task appears in the reviewer inbox',
    );
    const strangerInbox = await call(app, 'GET', '/v1/me/reviews', undefined, strangerKey);
    assert.ok(!strangerInbox.body.items.some((t: { id: string }) => t.id === task.id));

    // A non-reviewer, non-admin member is forbidden from recording a verdict.
    const denied = await call(
      app,
      'POST',
      `/v1/tasks/${task.id}/review`,
      { verdict: 'approved' },
      strangerKey,
    );
    assert.equal(denied.status, 403, 'only the reviewer or an admin may review');

    // The reviewer approves -> task moves to a completed column with reason.
    const approve = await call(
      app,
      'POST',
      `/v1/tasks/${task.id}/review`,
      { verdict: 'approved', score: 5 },
      reviewerKey,
    );
    assert.equal(approve.status, 201);
    assert.equal(approve.body.verdict, 'approved');
    const afterApprove = (await call(app, 'GET', `/v1/tasks/${task.id}`, undefined, ownerKey)).body;
    assert.notEqual(afterApprove.statusColumnId, inReviewColId, 'approve moves off the review column');
    assert.ok(afterApprove.completedAt, 'approve sets completedAt');
    assert.equal(afterApprove.completionReason, 'completed');
    const inboxAfter = await call(app, 'GET', '/v1/me/reviews', undefined, reviewerKey);
    assert.ok(
      !inboxAfter.body.items.some((t: { id: string }) => t.id === task.id),
      'an approved task leaves the reviewer inbox',
    );

    // A second task taken through the reject path -> canceled column + reason.
    const task2 = (
      await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'Reject me' }, ownerKey)
    ).body;
    await call(
      app,
      'POST',
      `/v1/tasks/${task2.id}/request-review`,
      { reviewerMemberId: reviewer.id },
      ownerKey,
    );
    const reject = await call(
      app,
      'POST',
      `/v1/tasks/${task2.id}/review`,
      { verdict: 'rejected', comment: 'out of scope' },
      reviewerKey,
    );
    assert.equal(reject.status, 201);
    const afterReject = (await call(app, 'GET', `/v1/tasks/${task2.id}`, undefined, ownerKey)).body;
    assert.equal(afterReject.completionReason, 'canceled', 'reject sets completionReason=canceled');

    // The reviews list returns the recorded verdicts in order.
    const reviews = await call(app, 'GET', `/v1/tasks/${task.id}/reviews`, undefined, ownerKey);
    assert.equal(reviews.body.items.length, 1);
    assert.equal(reviews.body.items[0].verdict, 'approved');
    assert.equal(reviews.body.items[0].score, 5);

    // The blackboard recorded the review verbs.
    const verbs: string[] = (await call(app, 'GET', '/v1/activity', undefined, ownerKey)).body.items.map(
      (a: { verb: string }) => a.verb,
    );
    for (const expected of ['reviewer.assigned', 'review.requested', 'review.approved', 'review.rejected']) {
      assert.ok(verbs.includes(expected), `expected activity verb ${expected}`);
    }
  } finally {
    await client.close();
  }
});

// Commit a reset with an Idempotency-Key header (the plain `call` helper omits it).
async function commit(
  app: Hono<AppEnv>,
  path: string,
  body: unknown,
  key: string,
  idemKey: string,
): Promise<CallResult> {
  const res = await app.request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      'idempotency-key': idemKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

test('task-model-v2 reset: project dry-run -> commit soft-deletes (recoverable) + authz + idempotency', async () => {
  const { app, client, db } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Reset Team', ownerName: 'Lead' });
    const ownerKey: string = boot.body.apiKey.key;

    const project = (await call(app, 'POST', '/v1/projects', { key: 'RS', name: 'Reset' }, ownerKey)).body;
    const t1 = (await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'One' }, ownerKey)).body;
    const t2 = (await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'Two' }, ownerKey)).body;
    await call(app, 'POST', `/v1/tasks/${t1.id}/comments`, { body: 'hi' }, ownerKey);

    // authz: a member (non-admin) is forbidden even from the dry-run.
    const member = (
      await call(app, 'POST', '/v1/members', { displayName: 'Dev', role: 'member' }, ownerKey)
    ).body;
    const memberKey: string = (
      await call(app, 'POST', '/v1/keys', { memberId: member.id, scopes: ['read', 'write', 'admin'] }, ownerKey)
    ).body.key;
    const denyRole = await call(app, 'POST', `/v1/projects/${project.id}/reset`, { dryRun: true }, memberKey);
    assert.equal(denyRole.status, 403, 'member role cannot reset');

    // authz: an admin role but a key WITHOUT the admin scope is also forbidden.
    const admin = (
      await call(app, 'POST', '/v1/members', { displayName: 'Adm', role: 'admin' }, ownerKey)
    ).body;
    const adminNoScopeKey: string = (
      await call(app, 'POST', '/v1/keys', { memberId: admin.id, scopes: ['read', 'write'] }, ownerKey)
    ).body.key;
    const denyScope = await call(app, 'POST', `/v1/projects/${project.id}/reset`, { dryRun: true }, adminNoScopeKey);
    assert.equal(denyScope.status, 403, 'admin scope is required');

    // Dry-run (owner): reports the counts + a confirmation token, deletes nothing.
    const dry = await call(app, 'POST', `/v1/projects/${project.id}/reset`, { dryRun: true }, ownerKey);
    assert.equal(dry.status, 200);
    assert.equal(dry.body.scope, 'project');
    assert.equal(dry.body.targetId, project.id);
    assert.equal(dry.body.counts.tasks, 2);
    assert.equal(dry.body.counts.comments, 1);
    assert.ok(dry.body.confirmationToken, 'a confirmation token is issued');
    assert.ok(dry.body.expiresAt);
    // Nothing was deleted by the dry-run.
    const stillThere = await call(app, 'GET', `/v1/tasks?projectId=${project.id}`, undefined, ownerKey);
    assert.equal(stillThere.body.items.length, 2);

    // Commit without an Idempotency-Key header -> 400.
    const noIdem = await call(
      app,
      'POST',
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dry.body.confirmationToken },
      ownerKey,
    );
    assert.equal(noIdem.status, 400);
    assert.equal(noIdem.body.error.code, 'idempotency_key_required');

    // Commit with the token + header -> soft-deletes the tasks (recoverable).
    const committed = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dry.body.confirmationToken },
      ownerKey,
      'idem-project-1',
    );
    assert.equal(committed.status, 200);
    assert.equal(committed.body.counts.tasks, 2);
    const afterReset = await call(app, 'GET', `/v1/tasks?projectId=${project.id}`, undefined, ownerKey);
    assert.equal(afterReset.body.items.length, 0, 'all tasks are trashed (hidden from the list)');

    // Recoverable: the trashed tasks can be restored.
    const restore = await call(app, 'POST', `/v1/tasks/${t2.id}/restore`, undefined, ownerKey);
    assert.equal(restore.status, 200);
    const afterRestore = await call(app, 'GET', `/v1/tasks?projectId=${project.id}`, undefined, ownerKey);
    assert.ok(afterRestore.body.items.some((t: { id: string }) => t.id === t2.id), 'restore brings a task back');

    // The token is single-use: replaying the SAME idempotency key replays the
    // stored response (still 200, same counts) without re-running.
    const replay = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dry.body.confirmationToken },
      ownerKey,
      'idem-project-1',
    );
    assert.equal(replay.status, 200);
    assert.equal(replay.body.counts.tasks, 2, 'idempotent replay returns the original result');

    // Reusing the SAME idempotency key for a DIFFERENT request (different token)
    // must 409 - never silently replay the stale result and skip the new op.
    const keyConflict = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: 'a-different-token' },
      ownerKey,
      'idem-project-1',
    );
    assert.equal(keyConflict.status, 409, 'reusing a key for a different request is rejected');
    assert.equal(keyConflict.body.error.code, 'idempotency_key_conflict');

    // A fresh commit with a NEW idempotency key but the consumed token -> 410.
    const consumed = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dry.body.confirmationToken },
      ownerKey,
      'idem-project-2',
    );
    assert.equal(consumed.status, 410, 'a consumed token cannot be reused');

    // Counts-drift 409: dry-run, then change the workspace, then commit.
    const t3 = (await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'Three' }, ownerKey)).body;
    const dry2 = await call(app, 'POST', `/v1/projects/${project.id}/reset`, { dryRun: true }, ownerKey);
    await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'Four (drift)' }, ownerKey);
    const drift = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dry2.body.confirmationToken },
      ownerKey,
      'idem-project-3',
    );
    assert.equal(drift.status, 409, 'counts changed since the dry-run');
    assert.equal(drift.body.error.code, 'reset_counts_changed');
    assert.ok(t3.id);

    // Resetting an already-trashed project is refused (no silent re-stamp). Trash
    // the project row directly, then a fresh dry-run -> commit must 409.
    await db.update(schema.projects).set({ trashedAt: new Date() }).where(eq(schema.projects.id, project.id));
    const dryTrashed = await call(app, 'POST', `/v1/projects/${project.id}/reset`, { dryRun: true }, ownerKey);
    const onTrashed = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dryTrashed.body.confirmationToken },
      ownerKey,
      'idem-project-trashed',
    );
    assert.equal(onTrashed.status, 409, 'cannot reset an already-trashed project');
    assert.equal(onTrashed.body.error.code, 'project_already_trashed');

    // The blackboard + audit trail recorded the project.reset.
    const verbs: string[] = (await call(app, 'GET', '/v1/activity', undefined, ownerKey)).body.items.map(
      (a: { verb: string }) => a.verb,
    );
    assert.ok(verbs.includes('project.reset'), 'project.reset activity is written');
  } finally {
    await client.close();
  }
});

test('task-model-v2 reset: workspace clear + seed-demo + allowReset gate', async () => {
  const { app, client, db } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Clear Team', ownerName: 'Lead' });
    const ownerKey: string = boot.body.apiKey.key;
    const workspaceId: string = boot.body.workspace.id;

    const p1 = (await call(app, 'POST', '/v1/projects', { key: 'A', name: 'A' }, ownerKey)).body;
    await call(app, 'POST', '/v1/tasks', { projectId: p1.id, title: 'a1' }, ownerKey);
    const p2 = (await call(app, 'POST', '/v1/projects', { key: 'B', name: 'B' }, ownerKey)).body;
    await call(app, 'POST', '/v1/tasks', { projectId: p2.id, title: 'b1' }, ownerKey);

    // Workspace clear dry-run: counts both projects and their tasks.
    const dry = await call(app, 'POST', '/v1/workspaces/current/reset', { dryRun: true }, ownerKey);
    assert.equal(dry.status, 200);
    assert.equal(dry.body.scope, 'workspace');
    assert.equal(dry.body.counts.projects, 2);
    assert.equal(dry.body.counts.tasks, 2);

    const cleared = await commit(
      app,
      '/v1/workspaces/current/reset',
      { confirm: true, confirmationToken: dry.body.confirmationToken },
      ownerKey,
      'idem-ws-clear',
    );
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.counts.projects, 2);
    const projectsAfter = await call(app, 'GET', '/v1/projects', undefined, ownerKey);
    assert.equal(projectsAfter.body.items.length, 0, 'all projects are trashed');

    // Members + the owner key are preserved across the clear.
    const membersAfter = await call(app, 'GET', '/v1/members', undefined, ownerKey);
    assert.ok(membersAfter.body.items.length >= 1, 'members are preserved');
    assert.equal(membersAfter.status, 200, 'the owner key still authenticates');

    // seed-demo into the now-empty workspace: dry-run then commit.
    const seedDry = await call(app, 'POST', '/v1/workspaces/current/seed-demo', { dryRun: true }, ownerKey);
    assert.equal(seedDry.status, 200);
    assert.equal(seedDry.body.scope, 'demo');
    assert.equal(seedDry.body.counts.tasks, 8);
    const seeded = await commit(
      app,
      '/v1/workspaces/current/seed-demo',
      { confirm: true, confirmationToken: seedDry.body.confirmationToken },
      ownerKey,
      'idem-seed-1',
    );
    assert.equal(seeded.status, 200);
    assert.equal(seeded.body.counts.projects, 1);
    assert.equal(seeded.body.counts.tasks, 8);
    const demoProjects = await call(app, 'GET', '/v1/projects', undefined, ownerKey);
    assert.equal(demoProjects.body.items.length, 1, 'the demo project exists');
    const demoTasks = await call(
      app,
      'GET',
      `/v1/tasks?projectId=${demoProjects.body.items[0].id}`,
      undefined,
      ownerKey,
    );
    assert.equal(demoTasks.body.items.length, 8, 'demo tasks are seeded');

    // seed-demo refuses on a non-empty workspace unless force:true.
    const seedDry2 = await call(app, 'POST', '/v1/workspaces/current/seed-demo', { dryRun: true }, ownerKey);
    const refused = await commit(
      app,
      '/v1/workspaces/current/seed-demo',
      { confirm: true, confirmationToken: seedDry2.body.confirmationToken },
      ownerKey,
      'idem-seed-2',
    );
    assert.equal(refused.status, 409, 'seed-demo refuses on a non-empty workspace');
    assert.equal(refused.body.error.code, 'workspace_not_empty');
    const seedDry3 = await call(app, 'POST', '/v1/workspaces/current/seed-demo', { dryRun: true }, ownerKey);
    const forced = await commit(
      app,
      '/v1/workspaces/current/seed-demo',
      { confirm: true, confirmationToken: seedDry3.body.confirmationToken, force: true },
      ownerKey,
      'idem-seed-3',
    );
    assert.equal(forced.status, 200, 'force:true seeds anyway');

    // allowReset = false disables the destructive endpoints (403 reset_disabled).
    await db.update(schema.workspaces).set({ allowReset: false }).where(eq(schema.workspaces.id, workspaceId));
    const disabled = await call(app, 'POST', '/v1/workspaces/current/reset', { dryRun: true }, ownerKey);
    assert.equal(disabled.status, 403, 'reset is disabled when allowReset=false');

    // The audit log captured the destructive actions.
    const auditRows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.workspaceId, workspaceId));
    const actions = auditRows.map((a: { action: string }) => a.action);
    assert.ok(actions.includes('workspace.cleared'), 'workspace.cleared is audited');
    assert.ok(actions.includes('workspace.seeded_demo'), 'workspace.seeded_demo is audited');
  } finally {
    await client.close();
  }
});

test('task-model-v2 reset: project reset with restoreDefaultColumns rebuilds the board (FK-safe)', async () => {
  const { app, client } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Board Team', ownerName: 'Lead' });
    const key: string = boot.body.apiKey.key;
    const project = (await call(app, 'POST', '/v1/projects', { key: 'BD', name: 'Board' }, key)).body;

    // A custom column beyond the defaults + a task moved into 'done'.
    await call(app, 'POST', `/v1/projects/${project.id}/columns`, { key: 'extra', name: 'Extra', category: 'started' }, key);
    const t1 = (await call(app, 'POST', '/v1/tasks', { projectId: project.id, title: 'shipme' }, key)).body;
    await call(app, 'POST', `/v1/tasks/${t1.id}/status`, { statusColumnKey: 'done' }, key);
    const before = await call(app, 'GET', `/v1/projects/${project.id}/columns`, undefined, key);
    assert.equal(before.body.items.length, 7, 'custom column present before reset');

    const dry = await call(app, 'POST', `/v1/projects/${project.id}/reset`, { dryRun: true }, key);
    const committed = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dry.body.confirmationToken, restoreDefaultColumns: true },
      key,
      'idem-board-1',
    );
    assert.equal(committed.status, 200, 'restoreDefaultColumns commit succeeds (no FK violation)');

    // Board is back to exactly the 6 defaults; the custom column is gone.
    const after = await call(app, 'GET', `/v1/projects/${project.id}/columns`, undefined, key);
    assert.equal(after.body.items.length, 6, 'board is rebuilt to the default columns');
    assert.deepEqual(
      after.body.items.map((c: { key: string }) => c.key),
      ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'],
    );

    // The trashed task is restorable and lands on a valid (repointed) column.
    const restored = await call(app, 'POST', `/v1/tasks/${t1.id}/restore`, undefined, key);
    assert.equal(restored.status, 200);
    assert.ok(restored.body.statusColumnId, 'restored task points at a live column');
    const live = after.body.items.map((c: { id: string }) => c.id);
    assert.ok(live.includes(restored.body.statusColumnId), 'repointed column is one of the new defaults');
  } finally {
    await client.close();
  }
});

test('task-model-v2: labelIds+reviewer on create inline in list; single-task review back-edge -> approve; reset soft-delete keeps the row', async () => {
  const { app, client, db } = await setup();
  try {
    const boot = await call(app, 'POST', '/v1/workspaces', { name: 'Inline Team', ownerName: 'Lead' });
    const ownerKey: string = boot.body.apiKey.key;
    const ownerId: string = boot.body.owner.id;

    // A reviewer member (role=member) with their own key.
    const reviewer = (
      await call(app, 'POST', '/v1/members', { displayName: 'Reviewer', role: 'member' }, ownerKey)
    ).body;
    const reviewerKey: string = (
      await call(app, 'POST', '/v1/keys', { memberId: reviewer.id, scopes: ['read', 'write'] }, ownerKey)
    ).body.key;

    const project = (await call(app, 'POST', '/v1/projects', { key: 'INL', name: 'Inline' }, ownerKey)).body;
    const label = (
      await call(app, 'POST', `/v1/projects/${project.id}/labels`, { name: 'backend', color: '#0af' }, ownerKey)
    ).body;

    // --- Rich create: type + acceptanceCriteria + labelIds + reviewerMemberId ---
    const created = await call(
      app,
      'POST',
      '/v1/tasks',
      {
        projectId: project.id,
        title: 'Build with all the fixings',
        type: 'code',
        acceptanceCriteria: [{ text: 'Compiles' }, { kind: 'scenario', text: 'Given X when Y then Z' }],
        labelIds: [label.id],
        reviewerMemberId: reviewer.id,
      },
      ownerKey,
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.type, 'code');
    assert.equal(created.body.reviewerMemberId, reviewer.id, 'reviewer is set on create');
    assert.equal(created.body.acceptanceCriteria.length, 2);
    const taskId: string = created.body.id;

    // GET /tasks inlines BOTH labels and AC progress in one shot.
    const list = await call(app, 'GET', `/v1/tasks?projectId=${project.id}&type=code`, undefined, ownerKey);
    assert.equal(list.body.items.length, 1);
    const listed = list.body.items[0];
    assert.equal(listed.labels.length, 1, 'labels are inlined on the list view');
    assert.equal(listed.labels[0].id, label.id);
    assert.deepEqual(listed.acProgress, { done: 0, total: 2 }, 'AC progress is inlined on the list view');

    // Filtering by that label returns the task (label-join EXISTS path).
    const byLabel = await call(app, 'GET', `/v1/tasks?projectId=${project.id}&label=backend`, undefined, ownerKey);
    assert.ok(byLabel.body.items.some((t: { id: string }) => t.id === taskId), 'label filter matches');

    // --- Single-task full review loop: request-review -> changes_requested -> approved ---
    const rr = await call(
      app,
      'POST',
      `/v1/tasks/${taskId}/request-review`,
      { reviewerMemberId: reviewer.id },
      ownerKey,
    );
    assert.equal(rr.status, 200);
    const inReviewColId: string = rr.body.statusColumnId;

    // changes_requested: the reviewer sends it BACK to a started, non-review column.
    const changes = await call(
      app,
      'POST',
      `/v1/tasks/${taskId}/review`,
      { verdict: 'changes_requested', comment: 'fix the edge case' },
      reviewerKey,
    );
    assert.equal(changes.status, 201);
    assert.equal(changes.body.verdict, 'changes_requested');
    const afterChanges = (await call(app, 'GET', `/v1/tasks/${taskId}`, undefined, ownerKey)).body;
    assert.notEqual(afterChanges.statusColumnId, inReviewColId, 'changes_requested moves the task off review');
    assert.equal(afterChanges.completedAt, null, 'a re-opened task is not completed');

    // The back-edge writes a task.reopened activity verb.
    const midVerbs: string[] = (await call(app, 'GET', '/v1/activity', undefined, ownerKey)).body.items.map(
      (a: { verb: string }) => a.verb,
    );
    assert.ok(midVerbs.includes('task.reopened'), 'changes_requested writes task.reopened');
    assert.ok(midVerbs.includes('review.changes_requested'), 'changes_requested writes review.changes_requested');

    // The same task goes back to review, then the reviewer approves it.
    await call(app, 'POST', `/v1/tasks/${taskId}/request-review`, { reviewerMemberId: reviewer.id }, ownerKey);
    const approve = await call(
      app,
      'POST',
      `/v1/tasks/${taskId}/review`,
      { verdict: 'approved', score: 5 },
      reviewerKey,
    );
    assert.equal(approve.status, 201);
    const afterApprove = (await call(app, 'GET', `/v1/tasks/${taskId}`, undefined, ownerKey)).body;
    assert.ok(afterApprove.completedAt, 'approve sets completedAt on the same task');
    assert.equal(afterApprove.completionReason, 'completed');

    // --- Reset soft-delete keeps the physical row (trashedAt set, not a hard DELETE) ---
    const dry = await call(app, 'POST', `/v1/projects/${project.id}/reset`, { dryRun: true }, ownerKey);
    assert.equal(dry.status, 200);
    assert.equal(dry.body.counts.tasks, 1);
    const committed = await commit(
      app,
      `/v1/projects/${project.id}/reset`,
      { confirm: true, confirmationToken: dry.body.confirmationToken },
      ownerKey,
      'idem-inline-reset',
    );
    assert.equal(committed.status, 200);

    // Vanishes from GET /tasks ...
    const afterReset = await call(app, 'GET', `/v1/tasks?projectId=${project.id}`, undefined, ownerKey);
    assert.equal(afterReset.body.items.length, 0, 'trashed task is hidden from the list');

    // ... but the row is STILL THERE in the DB with trashedAt stamped (recoverable).
    const rows = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
    assert.equal(rows.length, 1, 'soft-delete keeps the physical row');
    assert.notEqual(rows[0]!.trashedAt, null, 'trashedAt is set by the reset commit');
    assert.equal(rows[0]!.trashedByMemberId, ownerId, 'the committing member is recorded as trasher');

    // And the direct single-task read still returns it with trashedAt populated.
    const direct = await call(app, 'GET', `/v1/tasks/${taskId}`, undefined, ownerKey);
    assert.equal(direct.status, 200);
    assert.ok(direct.body.trashedAt, 'single-task read exposes the trashedAt timestamp');
  } finally {
    await client.close();
  }
});
