import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  sql: ReturnType<typeof postgres>;
}

/** Open a pooled connection and bind the Drizzle query builder to our schema. */
export function createDb(databaseUrl: string, max = 10): DbHandle {
  const sql = postgres(databaseUrl, { max });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
