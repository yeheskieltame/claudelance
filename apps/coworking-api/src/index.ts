import { serve } from '@hono/node-server';

import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { createServer } from './server.js';

function log(message: string, meta: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), message, ...meta }));
}

async function main(): Promise<void> {
  const cfg = loadConfig();

  if (cfg.migrateOnStart) {
    await runMigrations(cfg.databaseUrl);
    log('coworking.migrated');
  }

  const { db, sql } = createDb(cfg.databaseUrl);
  const app = createServer({ db, cfg });

  serve({ fetch: app.fetch, port: cfg.port });
  log('coworking.start', { port: cfg.port, env: cfg.nodeEnv });

  const shutdown = (): void => {
    void sql.end({ timeout: 5 }).finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ message: 'coworking.fatal', error: String(err) }));
  process.exit(1);
});
