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

Part of the [Claudelance](https://github.com/yeheskieltame/claudelance) monorepo.
