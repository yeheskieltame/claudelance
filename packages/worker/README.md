# @yeheskieltame/claudelance-worker

The Claudelance worker runtime. It turns the [Coworking API](../../apps/coworking-api)
into the shared workplace for a team of **independent** AI agents - each with its own
expertise, its own API key, and its own seat on the board. Every bit of coordination
(who does what, hand-offs, reviews) flows through the Coworking API; workers never talk
to each other directly.

Zero runtime dependencies - it runs on a bare `node >= 20`, no build, no install.

## Architecture

```
                 Coworking API  (the only coordination channel)
                  workspace: claudelance / project: CLX
                          |  board: tasks, claims, comments, reviews
   +----------+----------+----------+----------+----------+ ...
   |          |          |          |          |          |
contracts  frontend   relayer    backend     sdk      security  ...   <- independent agents
 (Claude    (Claude    (Claude    (Claude   (Claude    (Claude         each = its own
  Code)      Code)      Code)      Code)     Code)      Code)          MCP key + brief
```

- **One member per role** on the board, each holding an API key scoped `read,write`.
- **The orchestrator** (workspace owner) seeds work, triages, and reviews.
- A worker is **stateless**: it reads its next task from the board, does it, reports back.
  Scale the team by adding a row to `src/roster.js` and re-running bootstrap + kits.

## Quickstart

```bash
export COWORKING_API_URL=https://<live-coworking-api>
export CLW_OWNER_KEY=<owner/admin key>

node src/cli.js bootstrap   # members + keys + CLX project + starter backlog
node src/cli.js kits        # writes workers/<role>/ agent kits (gitignored)
node src/cli.js status      # board overview
```

`bootstrap` writes the per-role keys to `.local/.env.workers` and the id map to
`.local/workspace.json` (both gitignored). It is idempotent - safe to re-run.

## Running a worker

**Interactive (recommended)** - a full Claude Code session wired to the board:

```bash
bash workers/contracts/run.sh
```

The kit gives that session a `.mcp.json` (HTTP MCP -> `<api>/mcp`, authed with the
worker's key) and a `brief.md` appended to its system prompt. The session pulls work
from the board with the `claudelance` MCP tools (`whats_next`, `claim_task`,
`update_task_status`, `add_comment`, `request_review`, ...).

**Headless** - autonomous loop driving `claude -p`:

```bash
node src/cli.js run contracts --once --dry   # claim + report, no code (smoke test)
node src/cli.js run contracts                # plan-mode loop (proposes; safe default)
node src/cli.js run contracts --apply        # lets the agent edit files
```

Plan-mode is the default on purpose: the agent proposes and routes through the review
loop. `--apply` enables edits; run one `--apply` worker at a time (no worktree isolation
yet - see the `ponytail:` note in `src/loop.js`).

## The daily loop

1. Post yesterday / today / blockers on the **Daily standup** task.
2. `whats_next` / `my_open_tasks`, claim a task in your expertise, move it to In Progress.
3. Do the work on branch `worker/<role>`, per-file commits.
4. `request_review`; the Tech Lead approves (`clw orchestrate approve <taskId>`).
   Approved reviews bridge to ERC-8004 reputation feedback for agents with a linked id.

## The team

| role | owns |
|------|------|
| contracts | `contracts/` Solidity v2/v3, Foundry, UUPS |
| frontend | `apps/web/` Next.js + MiniPay |
| relayer | `apps/relayer/` keeper, gas safety |
| backend | `apps/coworking-api/` Hono + Postgres |
| sdk | `packages/*` typed clients |
| identity | ERC-8004, 8004scan, reputation bridge |
| security | scope/authz, reentrancy review |
| devrel | docs, README, npm/GH Packages |
| qa | tests, CI, deploy verification |
