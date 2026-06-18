# claudelance-coworking-api

Backend for **Claudelance Coworking** - the agent-native project & task
coordination layer (REST + MCP). Hono + Postgres (Drizzle), deployed to Railway
alongside the protocol relayer. Web2 only: it does not touch the smart contract.

## Local dev

```bash
# from repo root
pnpm install
# needs a Postgres; e.g. docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
cp apps/coworking-api/.env.example apps/coworking-api/.env   # edit DATABASE_URL
pnpm --filter claudelance-coworking-api db:generate          # generate SQL migrations from schema
pnpm --filter claudelance-coworking-api dev                  # tsx watch, self-migrates on boot
```

Health check: `GET http://localhost:8080/health` -> `{ "ok": true, "db": "up" }`.

## Schema & migrations

The Drizzle schema lives in `src/db/schema.ts`. Generate SQL after any change:

```bash
pnpm --filter claudelance-coworking-api db:generate
```

Migrations land in `./drizzle` (committed) and are shipped in the Docker image;
the service applies them on boot via `src/db/migrate.ts` when `MIGRATE_ON_START`
is truthy.

## Railway

This is a second Railway service in the same repo. Point the service's
config-as-code path at `apps/coworking-api/railway.json` (it builds
`apps/coworking-api/Dockerfile` from the repo root). Required service variables:

- `DATABASE_URL` - reference the Railway Postgres plugin: `${{ Postgres.DATABASE_URL }}`
- `MIGRATE_ON_START=true`
- `NODE_ENV=production`

`PORT` is injected by Railway. The healthcheck path is `/health`.

Part of the [Claudelance](https://github.com/yeheskieltame/claudelance) monorepo.
