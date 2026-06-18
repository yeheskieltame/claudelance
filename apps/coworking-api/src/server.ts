import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { CoworkingConfig } from './config.js';
import type { Database } from './db/client.js';
import type { AppEnv } from './lib/context.js';
import { errorHandler } from './lib/errors.js';
import { mcpHandler, type CallApi } from './mcp/server.js';
import { activityRoutes } from './routes/activity.js';
import { automationRoutes } from './routes/automations.js';
import { coordinationRoutes } from './routes/coordination.js';
import { goalRoutes } from './routes/goals.js';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';
import { timeRoutes } from './routes/time.js';
import { webhookRoutes } from './routes/webhooks.js';
import { publicWorkspaceRoutes, workspaceRoutes } from './routes/workspaces.js';

export interface ServerDeps {
  db: Database;
  cfg: CoworkingConfig;
}

/**
 * Build the Coworking HTTP surface: service root, DB health probe, the versioned
 * REST API, and the MCP endpoint. Auth is applied per authed router (each calls
 * authMiddleware), so the public bootstrap route stays open. The MCP endpoint is
 * a thin JSON-RPC bridge that re-enters the REST API in-process.
 */
export function createServer({ db, cfg }: ServerDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', cors());
  app.onError(errorHandler);

  app.get('/', (c) =>
    c.json({
      name: 'Claudelance Coworking API',
      role: 'Agent-native project & task coordination (REST + MCP)',
      version: '0.1.0',
      env: cfg.nodeEnv,
    }),
  );

  app.get('/health', async (c) => {
    try {
      await db.execute(sql`select 1`);
      return c.json({ ok: true, db: 'up' });
    } catch (err) {
      return c.json(
        { ok: false, db: 'down', error: err instanceof Error ? err.message : String(err) },
        503,
      );
    }
  });

  const v1 = new Hono<AppEnv>();
  v1.route('/', publicWorkspaceRoutes(db)); // POST /workspaces - no auth
  v1.route('/', workspaceRoutes(db)); // /workspace, /members, /keys
  v1.route('/', projectRoutes(db)); // /projects, /projects/:id/columns
  v1.route('/', taskRoutes(db)); // /tasks, status/claim/assign, comments, dependencies
  v1.route('/', timeRoutes(db)); // /tasks/:id/check-in, check-out, time
  v1.route('/', goalRoutes(db)); // /goals, /goals/:id/links
  v1.route('/', automationRoutes(db)); // /projects/:id/automations, /automations/:id
  v1.route('/', webhookRoutes(db)); // /webhooks
  v1.route('/', coordinationRoutes(db)); // /me/tasks, /me/blocked, /projects/:id/next
  v1.route('/', activityRoutes(db)); // /activity
  app.route('/v1', v1);

  // MCP bridge: re-enter the REST API in-process, forwarding the caller's key.
  const callApi: CallApi = (method, path, body, authorization) =>
    // app.request is typed Response | Promise<Response>; normalize to a promise.
    Promise.resolve(
      app.request(path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  app.post('/mcp', mcpHandler(callApi));

  return app;
}
