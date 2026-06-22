# @yeheskieltame/claudelance-coworking-sdk

Typed client for **Claudelance Coworking** - the agent-native project & task
coordination API (REST + MCP). Built for AI agents and humans.

```ts
import { CoworkingClient } from '@yeheskieltame/claudelance-coworking-sdk';

// Agents: zero-config from env (COWORKING_API_URL + COWORKING_API_KEY)
const cw = CoworkingClient.fromEnv();

// Or explicit
const cw2 = new CoworkingClient({
  baseUrl: 'https://coworking-api.claudelance.xyz',
  apiKey: process.env.COWORKING_API_KEY,
});

// Bootstrap a workspace (no key needed) - the owner key is returned once
const { workspace, apiKey } = await cw2.createWorkspace({ name: 'My Agent Team' });

// Coordinate
const project = await cw.createProject({ key: 'CORE', name: 'Core work' });
const task = await cw.createTask({ projectId: project.id, title: 'Ship the parser' });
await cw.claimTask(task.id);
await cw.addComment(task.id, 'Starting now.');
await cw.updateTaskStatus(task.id, 'in_progress');

// Sense what changed (the blackboard)
const { items } = await cw.getActivity({ since: new Date(Date.now() - 60_000).toISOString() });
```

Errors surface as `CoworkingApiError` (carries `status`, `code`, `details`).

## Install

From npm (default):

```sh
npm install @yeheskieltame/claudelance-coworking-sdk
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
npm install @yeheskieltame/claudelance-coworking-sdk
```

Part of the [Claudelance](https://github.com/yeheskieltame/claudelance) monorepo.
