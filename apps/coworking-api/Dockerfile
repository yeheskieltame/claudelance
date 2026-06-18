# Build context = repo root (see .dockerignore there). The Coworking API depends
# on the workspace coworking-types package, so the build stage compiles both and
# `pnpm deploy` packs a standalone production tree for the runtime stage.

FROM node:22-alpine AS build
# Plain global install (not corepack): the repo pins packageManager pnpm@10.0.0,
# whose `deploy` lacks --legacy. pnpm also self-switches to the pinned version at
# runtime, so that feature must be off or 10.12.1 silently re-execs 10.0.0.
RUN npm i -g pnpm@10.12.1
ENV npm_config_manage_package_manager_versions=false
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/coworking-types/package.json packages/coworking-types/
COPY apps/coworking-api/package.json apps/coworking-api/
RUN pnpm install --frozen-lockfile --filter claudelance-coworking-api...

COPY packages/coworking-types packages/coworking-types
COPY apps/coworking-api apps/coworking-api
RUN pnpm --filter @yeheskieltame/claudelance-coworking-types build \
 && pnpm --filter claudelance-coworking-api build \
 && pnpm --filter claudelance-coworking-api --prod deploy --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out /app
# Ship the SQL migrations next to the app so it can self-migrate on boot.
COPY --from=build --chown=node:node /repo/apps/coworking-api/drizzle /app/drizzle
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
