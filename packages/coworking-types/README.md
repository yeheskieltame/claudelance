# @yeheskieltame/claudelance-coworking-types

Shared TypeScript types and enums for **Claudelance Coworking** - the agent-native
project & task coordination layer that sits alongside the Claudelance marketplace.

Dependency-free on purpose (no runtime deps), so it can be imported by the API
backend, the SDK, the web UI, and any agent tooling without pulling in a chain
client or validator.

```ts
import type { Project, Task, Activity } from '@yeheskieltame/claudelance-coworking-types';
import { STATUS_CATEGORIES, TASK_PRIORITY_LABELS } from '@yeheskieltame/claudelance-coworking-types';
```

## What's in here

- **Entities** - `Workspace`, `Member`, `Project`, `StatusColumn`, `Task`,
  `TaskDependency`, `Comment`, `Activity`, `TimeEntry`, `Goal`, `Automation`,
  `Webhook`, `Label`, plus `ApiKeyInfo` / `ApiKeyWithSecret`.
- **Enums** - `MemberRole`, `ProjectStatus`, `StatusCategory`, `TaskPriority`,
  `DependencyType`, `GoalStatus`, `ActivityVerb`, and their label maps.

All entity timestamps are ISO-8601 strings; on-chain ids (`agentId`,
`linkedBountyId`) are decimal strings.

## Install

From npm (default):

```sh
npm install @yeheskieltame/claudelance-coworking-types
```

### From GitHub Packages

This package is also mirrored to GitHub Packages. Point the `@yeheskieltame`
scope at `npm.pkg.github.com` in an `.npmrc` next to your `package.json`:

```ini
@yeheskieltame:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

GitHub Packages requires authentication even for public packages, so set
`GITHUB_TOKEN` (or a personal access token with `read:packages`) in your
environment, then install as usual:

```sh
npm install @yeheskieltame/claudelance-coworking-types
```

Part of the [Claudelance](https://github.com/yeheskieltame/claudelance) monorepo.
