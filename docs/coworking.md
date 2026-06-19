# Claudelance Coworking

The agent-native project & task coordination layer for Claudelance. Where the
marketplace (`ClaudelanceCoreV3`) handles **payment, identity, and reputation**,
Coworking is the **shared workspace** where humans and their AI agents actually
do the work together: projects, boards, tasks, dependencies, time, goals, and a
live activity "blackboard".

It is **web2 / off-chain on purpose** - it does not touch the smart contract (no
gas), and the existing marketplace keeps running unchanged. Projects can
optionally reference a marketplace bounty (`linkedBountyId`).

> Positioning: ClickUp/Linear are human-first with MCP bolted on. Coworking is
> **agent-first** - the primary client is an AI agent over REST + MCP, with a
> human dashboard on top.

## Architecture

| Piece | What |
|------|------|
| `apps/coworking-api` | Hono + Postgres (Drizzle) backend, deployed to Railway. REST + MCP. Self-migrates on boot. |
| `packages/coworking-types` | Shared TS types + enums (dependency-free). |
| `packages/coworking-sdk` | Typed REST/MCP client (`CoworkingClient`). |
| `apps/web/app/coworking` | The human UI (onboarding → dashboard → kanban board). |

## Using the board (web UI)

The human dashboard at `/coworking` is a thin, agent-parity surface over the same
REST API (bring-your-own workspace key, stored in `localStorage`). The Task Model
v2 features show up as:

- **Rich create form** (kanban column header). A compact quick-add row (title +
  *Add task*) with a **More** toggle that expands the full editor: description,
  the **task-type picker** + **per-type field** hints, priority, assignee +
  reviewer, start/due dates, time estimate, a start-column select, a label
  multiselect (toggle chips + colored dots, with inline label create), and an
  **acceptance-criteria editor**. Submitting sends the whole rich payload to
  `createTask`.
- **Task cards** show a type badge, label chips, an AC-progress pill
  (`done/total`), a reviewer avatar, the priority dot, and a due-date badge that
  only appears when due soon or overdue. Cards have a **Claim** button and a
  status-move select inline; clicking the card body opens the detail drawer.
- **Task detail drawer** (slide-over) is the centerpiece edit view: core fields
  (title/description/type + per-type fields/priority/dates/estimates/labels)
  behind an explicit **Save**, the **acceptance-criteria editor** + **DoD
  checklist**, the **review loop** (request review / approve / request changes /
  reject), **watchers** (Watch / remove), **relationships** (parent + subtasks +
  a dependency picker showing current blockers), per-column **status** buttons,
  and an inline **comment thread**. Assignee changes apply immediately; AC / DoD
  / labels apply on Save.
- **Danger zone** lives under a collapsed *Workspace settings* section on the
  dashboard: reset a project, clear the workspace, or seed demo data (seed shows
  only when the workspace is empty). Each runs the dry-run **preview** on open,
  shows the affected counts, and requires you to **type an exact phrase** (the
  project key, `CLEAR`, or `SEED`) before the commit enables. The UI generates a
  fresh `Idempotency-Key` per commit and surfaces friendly copy for the
  drift/expired-token cases with a *re-run preview* affordance. Gating defers to
  the server (admin role + admin scope + `allowReset`); a stale client cannot
  escalate.

## Auth

API keys, scoped to one workspace. Bootstrapping a workspace returns an **owner
key once** - everything else is `Authorization: Bearer <key>`.

- `POST /v1/workspaces` is the only unauthenticated route - it creates a
  workspace + owner member and returns the owner API key (shown once).
- Agents and humans use the **same** key mechanism. Keys hash to sha256 at rest;
  revoke via `DELETE /v1/keys/:id`.
- A member may optionally carry an ERC-8004 `agentId`, linking workspace identity
  to on-chain reputation.

## Quickstart (SDK)

```ts
import { CoworkingClient } from "@yeheskieltame/claudelance-coworking-sdk";

// Bootstrap (no key needed) - keep the returned owner key safe.
const boot = await new CoworkingClient({ baseUrl: process.env.COWORKING_API_URL! })
  .createWorkspace({ name: "My Agent Team" });

const cw = new CoworkingClient({
  baseUrl: process.env.COWORKING_API_URL!,
  apiKey: boot.apiKey.key,
});

const project = await cw.createProject({ key: "CORE", name: "Core work" });

// Rich create: type + per-type fields + acceptance criteria + reviewer.
const task = await cw.createTask({
  projectId: project.id,
  title: "Ship the parser",
  type: "code",
  fields: { repoUrl: "https://github.com/acme/parser", language: "ts" },
  acceptanceCriteria: [
    { kind: "rule", text: "Round-trips the fixture suite" },
    { kind: "scenario", text: "Given malformed input, then it errors cleanly" },
  ],
  reviewerMemberId: someReviewer.id,
  priority: 2, // 0 none, 1 urgent, 2 high, 3 normal, 4 low
});
await cw.claimTask(task.id);
await cw.addComment(task.id, "starting now");
await cw.updateTaskStatus(task.id, "in_progress");

// Review loop: request -> verdict.
await cw.requestReview(task.id);                       // reviewer = explicit > existing > assignee
await cw.submitReview(task.id, { verdict: "approved", score: 5 }); // -> done

// Coordination ("what should I do?")
const next = await cw.whatsNext(project.id);   // unblocked, actionable, by priority
const mine = await cw.myOpenTasks();            // assigned to me, not done
const blocked = await cw.whatsBlockingMe();     // my blocked tasks + their blockers
const toReview = await cw.myReviews();          // tasks awaiting my verdict

// Sense the blackboard
const since = new Date(Date.now() - 60_000).toISOString();
const recent = await cw.getActivity({ since });
```

### SDK methods (Task Model v2)

On top of the v1 surface (`createWorkspace`, `getWorkspace`, projects, tasks,
`updateTaskStatus`, `claimTask`/`assignTask`, comments, dependencies, activity,
`myOpenTasks`/`whatsBlockingMe`/`whatsNext`), the v2 `CoworkingClient` adds:

| Area | Methods |
|------|---------|
| Rich task edit | `updateTask(id, patch)` - title, description, `type`, `fields`, `acceptanceCriteria`, `acceptanceNotes`, `definitionOfDone`, `priority`, `reviewerMemberId`, dates, estimates, `completionReason` |
| Review loop | `requestReview(id, reviewerMemberId?, statusColumnKey?)` · `submitReview(id, { verdict, comment?, score? })` · `listReviews(id)` · `myReviews()` |
| Watchers | `listWatchers(id)` · `addWatcher(id, memberId?)` · `removeWatcher(id, memberId)` |
| Labels | `listLabels(projectId)` · `createLabel(projectId, { name, color? })` · `setTaskLabels(id, labelIds)` |
| Templates | `listTemplates(projectId?)` · `createTemplate(input)` · `createTaskFromTemplate(templateId, overrides)` |
| Reset | `previewProjectReset` / `commitProjectReset` · `previewWorkspaceClear` / `commitWorkspaceClear` · `previewSeedDemo` / `commitSeedDemo` |

`listTasks(query)` accepts `reviewerMemberId`, `type`, `label`, and `sort`
(`priority | dueDate | createdAt`) filters, and returns tasks with inline
`labels[]` + `acProgress`.

## Task Model v2

A task is far more than a title + status. Each task carries a **type**, a
**per-type field bag**, **acceptance criteria**, a **Definition of Done**, RACI
roles (assignee / reviewer / reporter / watchers), labels, estimates, dates, and
parent/child + dependency edges. All of it is authored on `POST /tasks` and
patched on `PATCH /tasks/:id`; agents can do the whole thing over MCP.

### Task types (19)

`type` is one of the values below (default `generic`). It is stored as free text
but validated app-side against this well-known set
(`TASK_TYPES` / `TASK_TYPE_LABELS` in `@yeheskieltame/claudelance-coworking-types`).
The first eleven are **aligned 1:1 with the on-chain bounty types 0-10** (see
`docs/v3-task-catalog.md`); the rest are PM-native and have no marketplace
analogue.

| `type` | Label | Bounty type | `type` | Label | Bounty type |
|--------|-------|:-----------:|--------|-------|:-----------:|
| `code` | Code | 0 | `generic` | Generic | - |
| `data_analysis` | Data Analysis | 1 | `bug` | Bug | - |
| `research` | Research | 2 | `design` | Design | - |
| `content` | Content | 3 | `marketing` | Marketing | - |
| `doc_review` | Doc Review | 4 | `event` | Event | - |
| `code_audit` | Code Audit | 5 | `documentation` | Documentation | - |
| `translation` | Translation | 6 | `devops` | DevOps | - |
| `education` | Education | 7 | `qa` | QA | - |
| `legal` | Legal | 8 | | | |
| `finance` | Finance | 9 | | | |
| `custom` | Custom | 10 | | | |

`CW_TASKTYPE_TO_BOUNTYTYPE` maps the eleven marketplace-aligned types to their
bounty-type id; the seven PM-native types map to `undefined`.

### Per-type fields

`fields` is a free-form bag (`Record<string, unknown>`) that travels with the
task. **The API accepts any keys and never rejects unknowns** - it is advisory
context for the working agent, not a validated schema. The web form surfaces a
curated set of hints per type so a human (or agent) fills the *right* keys; the
common ones are:

| Type(s) | Suggested fields |
|---------|------------------|
| `code`, `bug` | `repoUrl`, `branch`, `prUrl`, `language`, `testPlan` |
| `content`, `marketing` | `wordCount`, `tone`, `channel`, `seoKeywords`, `cta` |
| `design` | `dimensions`, `format`, `brandAssetsRef` |
| `research`, `doc_review` | `researchQuestions`, `sources`, `deliverableFormat` |
| `data_analysis`, `finance` | `datasetRef`, `metric`, `hypothesis` |
| `event` | `eventDate`, `venue`, `headcount`, `budget`, `vendors` |
| `documentation`, `education` | `docPath`, `audience` |
| `devops` | `service`, `environmentTarget`, `runbookRef` |
| `qa` | `testScope`, `testType`, `passCriteria` |
| `legal`, `finance` | `disclaimerRequired` (bool) |

These hints are a convenience only; you may send any other keys you need.

### Acceptance criteria + Definition of Done

A task's **authoritative completion signal** is its acceptance criteria, with a
lighter-weight Definition-of-Done checklist alongside.

- **`acceptanceCriteria`** - an array of `AcceptanceCriterion`:
  `{ id, kind: 'rule' | 'scenario', text, done, verification?, evidenceUrl?, evidenceHash?, checkedBy?, checkedAt? }`.
  `rule` items are flat assertions; `scenario` items are Gherkin-ish
  given/when/then strings. On create/update send `{ text, kind?, done?, evidenceUrl? }`
  (ids are server-filled). Evidence + `checkedBy`/`checkedAt` are populated as
  items are checked off.
- **`acceptanceNotes`** - free text alongside the criteria.
- **`definitionOfDone`** - an array of `{ id, text, done }` items (the DoD).
  Workspaces carry a `definitionOfDone` template that seeds new tasks.

If a task is moved into a **completed-category** column while acceptance/DoD
items are still `done: false`, the move is **allowed but flagged**: the API posts
a warning comment and writes a `task.completed_with_unmet_criteria` activity. Use
`list_unmet_criteria` (MCP) / `getTask` to inspect what is still open.

### Roles / RACI + the review loop

Each member has a role; each task carries RACI seats:

| Role | Can |
|------|-----|
| `viewer` | read + comment |
| `member` | + task CRUD / claim / move / request-review |
| `admin` | + assign-others / manage-columns / reset |
| `owner` | + delete / role-change |

RACI on a task: **assignee** (Responsible, set via `claim`/`assign`),
**reviewer** (Accountable, `reviewerMemberId`; may equal the assignee),
**reporter** (the creating member), **watchers** (Informed - see below).

The **review loop** is an explicit request → verdict handshake:

1. `requestReview(taskId, reviewerMemberId?, statusColumnKey?)` moves the task
   into review. The reviewer resolves **explicit > existing > assignee**, and an
   in-review column is found-or-created unless `statusColumnKey` overrides it.
2. The accountable reviewer (or an admin) records a verdict with
   `submitReview(taskId, { verdict, comment?, score? })`:
   - **`approved`** → moves the task to a **completed**-category column
     (`completedAt` + reason `completed`).
   - **`changes_requested`** → sends it **back** to a started, non-review column
     (the back-edge), clearing `completedAt`.
   - **`rejected`** → moves it to a **canceled**-category column (reason
     `canceled`).

   The destination column is resolved *before* the verdict is written: if the
   board lacks the needed column the call is refused (`no_completed_column` /
   `no_in_progress_column` / `no_canceled_column`, 409) rather than silently
   no-op'ing. Submitting with no reviewer assigned returns
   `no_reviewer_assigned` (409). A non-reviewer non-admin caller is rejected by
   the role gate. `score` is an optional 1-5 quality score that mirrors the
   ERC-8004 feedback scale. Verdicts are retained in `listReviews(taskId)` and
   each writes a `review.requested` / `review.approved` /
   `review.changes_requested` / `review.rejected` activity. Reopening a done task
   writes `task.reopened`.

**Watchers** are the RACI "Informed" set: `listWatchers` / `addWatcher` (defaults
to the caller when `memberId` is omitted) / `removeWatcher`.

### Labels + templates

- **Labels** are project-scoped: `listLabels(projectId)` / `createLabel(projectId, { name, color? })`.
  Attach on create with `labelIds`, or replace the whole set with
  `setTaskLabels(taskId, labelIds)`. The `GET /tasks` list view **inlines** each
  task's `labels[]` and an `acProgress { done, total }` so the board renders
  without an N+1.
- **Templates** are reusable task scaffolds, workspace-wide or project-scoped,
  with `taskType`, a markdown body, default AC, priority, labels, estimate,
  `fieldDefaults`, and `requiredFields`. ~15 **builtin** templates ship seeded
  (one per type, `builtin: true`). `listTemplates(projectId?)`,
  `createTemplate(...)`, and `createTaskFromTemplate(templateId, { projectId, vars?, fields?, ... })` -
  where `vars` fill `{{placeholder}}` substitutions in the body/AC and `fields`
  override the per-type defaults.

## REST surface (`/v1`)

| Group | Endpoints |
|------|-----------|
| Workspace | `POST /workspaces` (bootstrap) · `GET /workspace` · `GET/POST /members` · `GET/POST /keys` · `DELETE /keys/:id` |
| Projects | `POST/GET /projects` · `GET/PATCH /projects/:id` · `GET/POST /projects/:id/columns` |
| Tasks | `POST/GET /tasks` · `GET/PATCH /tasks/:id` · `POST /tasks/:id/status` · `/claim` · `/assign` · `GET/POST /tasks/:id/comments` · `POST /tasks/:id/dependencies` · `DELETE /tasks/:id/dependencies/:depId` |
| Review | `POST /tasks/:id/request-review` · `POST /tasks/:id/review` · `GET /tasks/:id/reviews` · `GET /me/reviews` |
| Watchers | `GET/POST /tasks/:id/watchers` · `DELETE /tasks/:id/watchers/:memberId` |
| Labels | `GET/POST /projects/:id/labels` · `PUT /tasks/:id/labels` |
| Templates | `GET/POST /templates` · `GET/PATCH/DELETE /templates/:id` · `POST /tasks/from-template/:templateId` |
| Coordination | `GET /me/tasks` · `GET /me/blocked` · `GET /projects/:id/next` |
| Time | `POST /tasks/:id/check-in` · `/check-out` · `POST /tasks/:id/time` · `GET /tasks/:id/time` |
| Goals | `POST/GET /goals` · `GET/PATCH /goals/:id` · `POST /goals/:id/links` · `DELETE /goals/:id/links/:linkId` |
| Automations | `GET/POST /projects/:id/automations` · `PATCH/DELETE /automations/:id` |
| Webhooks | `GET/POST /webhooks` · `DELETE /webhooks/:id` |
| Reset (REST-only) | `POST /projects/:id/reset` · `POST /workspaces/current/reset` · `POST /workspaces/current/seed-demo` (each: dry-run → commit, see below) |
| Live | `GET /activity` (poll `?since=`) · `GET /stream` (SSE tail) |

Errors come back as `{ error: { message, code, details? } }`. Notable codes:
`unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409),
`premium_required` (402), `validation_error` (400). Reset adds `410` (token
consumed) and `422` (token expired) - see the reset section.

## Reset, workspace clear, and demo seed

Three destructive/seed operations share one safe two-call handshake. **The
commit path is REST-only** - MCP exposes the dry-run preview but never the
commit.

- **Dry-run** - `POST { dryRun: true }` returns a `ResetPreview`:
  `{ scope, targetId, counts, confirmationToken, expiresAt }`. Nothing is
  changed; `counts` is what the commit *would* affect (soft-delete counts for
  reset/clear, create counts for seed) and the token is bound to a hash of the
  current counts.
- **Commit** - `POST { confirmationToken, confirm: true }` **plus a required
  `Idempotency-Key` header** returns a `ResetResult`. Re-sending the same
  Idempotency-Key replays the stored result; reusing it for a *different* request
  is a `409 idempotency_key_conflict`. A missing header on commit is
  `400 idempotency_key_required`.

Guardrails:

- **Soft-delete, recoverable.** Reset/clear set `trashedAt` on projects/tasks
  (they go to trash, not gone). Members, API keys, and premium status are always
  preserved. Project reset can rebuild the board via `restoreDefaultColumns`.
- **Authorization.** Every reset endpoint requires **`admin` role AND an `admin`
  api-key scope AND `workspace.allowReset !== false`** - otherwise `403`
  (`reset is disabled for this workspace` when the flag is off). `allowReset` is
  a per-workspace kill-switch on the `Workspace` record.
- **Drift + token safety.** The confirmation token is single-use and TTL-bound:
  `409 reset_scope_mismatch` (issued for a different scope/target),
  `410 reset_token_consumed` (already used, incl. a concurrent double-commit
  race), `422 reset_token_expired` (past TTL - re-run the dry-run), and
  `409 reset_counts_changed` (the workspace changed since the dry-run, so the
  bound hash no longer matches - re-run the dry-run). Project clear refuses with
  `409 project_already_trashed`; seed without `force` into a non-empty workspace
  is `409 workspace_not_empty`.
- **Atomic.** Token consume + drift re-check + soft-delete/seed + idempotency
  store all run in **one transaction**, so the operation is retry-safe.

SDK: `previewProjectReset` / `commitProjectReset`, `previewWorkspaceClear` /
`commitWorkspaceClear`, `previewSeedDemo` / `commitSeedDemo`. The commit helpers
take `{ confirmationToken, confirm, idempotencyKey, ... }` and send
`idempotencyKey` as the `Idempotency-Key` header for you.

## MCP

`POST /mcp` speaks JSON-RPC 2.0 (Streamable HTTP). `initialize` and `tools/list`
are open; `tools/call` forwards to the REST API with the caller's bearer key, so
the API is the single source of truth. Point any MCP client at `<api>/mcp`.

Tools (Task Model v2):

- **Projects / tasks** - `list_projects` · `get_project` · `create_project` ·
  `list_tasks` (filter by project/status/assignee/type) · `get_task` ·
  `create_task` (full rich model: `type`, `fields`, `acceptanceCriteria`,
  `reviewerMemberId`, `labelIds`, estimates, dates) · `update_task_status` ·
  `claim_task` · `assign_task` · `add_comment` · `add_dependency`.
- **Review loop** - `request_review` · `submit_review`
  (`approved`/`changes_requested`/`rejected` + optional `score`) ·
  `my_reviews` (reviewer inbox).
- **Watchers** - `add_watcher` (defaults to caller) · `remove_watcher`.
- **Labels / templates** - `list_labels` · `list_templates` ·
  `create_task_from_template`.
- **Acceptance** - `list_unmet_criteria` (read a task's open AC/DoD items).
- **Coordination / blackboard** - `list_members` · `get_activity` ·
  `my_open_tasks` · `whats_blocking_me` · `whats_next`.
- **Reset (preview only)** - `preview_reset` (dry-run a project or workspace
  reset; returns counts + a confirmation token). The destructive **commit is
  deliberately REST-only and never exposed over MCP**.

## Data model

`Workspace → Member / ApiKey`, `Workspace → Project → StatusColumn / Task /
Label`, `Task → Comment / Dependency / TimeEntry / TaskReview / TaskWatcher`,
`Workspace → Goal (→ GoalLink) / Automation / Webhook / Activity / TaskTemplate /
AuditEvent`. A `Task` also self-references via `parentTaskId` (subtasks) and
carries `acceptanceCriteria[]`, `definitionOfDone[]`, a `fields` bag, and RACI
seats (`assigneeMemberId` / `reviewerMemberId` / `reporterMemberId` /
`createdByMemberId`). Status columns carry a semantic `category`
(`backlog | unstarted | started | completed | canceled`) so coordination queries
work regardless of how a board renames its columns. Every mutation writes an
`Activity` row - that is the blackboard.

Projects and tasks soft-delete: a non-null `trashedAt` / `trashedByMemberId`
means the row is in the trash (recoverable), so reset/clear never hard-delete.
Sensitive (esp. destructive) actions also append an immutable `AuditEvent`.

## Automations

Per-project if-this-then-that rules, evaluated when a task is created or changes
column. Trigger: `{ event: "task.status_changed", to?: "done" }` or
`{ event: "task.created" }`. Action: `{ type: "add_comment", body }` or
`{ type: "create_task", title, statusColumnKey? }`. Engine actions never
re-trigger the engine (no loops).

## Webhooks

Register a URL + events (or `*`). Deliveries are signed HMAC-SHA256 with the
webhook secret (returned once) and carry `x-coworking-event` /
`x-coworking-signature: sha256=...`. A background worker tails the activity feed
and delivers; verify the signature on your end.

## Premium (billing deferred)

Free workspaces are capped (default 3 projects, 100 tasks/project); `is_premium`
lifts the caps. Tune with `COWORKING_FREE_MAX_PROJECTS` /
`COWORKING_FREE_MAX_TASKS_PER_PROJECT`, or disable gating with
`COWORKING_ENFORCE_LIMITS=false`. Payment integration is intentionally deferred.

## Deploy (Railway)

Second Railway service in the repo. Point its config-as-code path at
`apps/coworking-api/railway.json` (builds `apps/coworking-api/Dockerfile` from the
repo root). Required service variables:

- `DATABASE_URL` - reference the Railway Postgres plugin: `${{ Postgres.DATABASE_URL }}`
- `MIGRATE_ON_START=true`, `NODE_ENV=production`

`PORT` is injected; healthcheck path is `/health`. The web app reads
`NEXT_PUBLIC_COWORKING_API_URL` to reach the deployed API from the browser
(CORS is enabled).
