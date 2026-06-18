import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Apply pending SQL migrations. Uses a dedicated single-connection client that
 * is closed afterwards, per the drizzle-orm/postgres-js migrator guidance. The
 * compiled file lives at dist/db/migrate.js, so the shipped ./drizzle folder is
 * two levels up (see the Dockerfile COPY).
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const migrationClient = postgres(databaseUrl, { max: 1 });
  try {
    const db = drizzle(migrationClient);
    const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
    await migrate(db, { migrationsFolder });
  } finally {
    await migrationClient.end();
  }
}
