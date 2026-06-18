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
