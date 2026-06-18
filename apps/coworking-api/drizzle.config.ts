import { defineConfig } from 'drizzle-kit';

// Migrations are generated into ./drizzle and shipped in the Docker image so the
// service can self-migrate on boot (see src/db/migrate.ts). `generate` works
// offline from the schema; `migrate`/`push`/`studio` need DATABASE_URL.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  casing: 'snake_case',
});
