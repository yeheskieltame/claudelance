# Build context = repo root (see .dockerignore there). The relayer depends on
# the workspace types + sdk packages, so the build stage compiles all three and
# `pnpm deploy` packs a standalone production tree for the runtime stage.

FROM node:22-alpine AS build
# Plain global install (not corepack): the repo pins packageManager pnpm@10.0.0,
# whose `deploy` lacks --legacy. pnpm also self-switches to the pinned version
# at runtime, so that feature must be off or 10.12.1 silently re-execs 10.0.0.
RUN npm i -g pnpm@10.12.1
ENV npm_config_manage_package_manager_versions=false
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY packages/sdk/package.json packages/sdk/
COPY apps/relayer/package.json apps/relayer/
RUN pnpm install --frozen-lockfile --filter claudelance-relayer...

COPY packages/types packages/types
COPY packages/sdk packages/sdk
COPY apps/relayer apps/relayer
RUN pnpm --filter @yeheskieltame/claudelance-types build \
 && pnpm --filter @yeheskieltame/claudelance-sdk build \
 && pnpm --filter claudelance-relayer build \
 && pnpm --filter claudelance-relayer --prod deploy --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out /app
USER node
EXPOSE 8787
CMD ["node", "dist/index.js"]
