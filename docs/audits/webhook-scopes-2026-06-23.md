# Webhook scopes re-audit - 2026-06-23

Security Auditor follow-up to the 2026-06-20 viewer-exfil finding (board task #7).
Scope: confirm the admin-gated webhook register/delete fix holds, then hunt for
sibling exfiltration paths in `apps/coworking-api`. AUDIT ONLY - no functional
code changed.

All line numbers are against the worktree at the time of audit (branch
`worker/security`).

## 1. Context: the original finding

`docs/AUDIT-2026-06-20.md` line 13 (HIGH):

> Webhook register/delete gated behind `admin` role - a `viewer` key could
> register an outbound sink that tails the whole activity feed (exfiltration).

The exfil mechanism: `services/webhooks.ts` `deliverPending()` tails the
`activities` table (the workspace blackboard - every mutation) and POSTs each
event to the registered URL (`services/webhooks.ts:18-68`). So whoever can
register a webhook can redirect the entire workspace feed to an attacker URL.
The fix was to require the `admin` role to register/delete a webhook.

## 2. Confirmation: the fix holds

Both mutating webhook routes gate on `admin` role. From
`apps/coworking-api/src/routes/webhooks.ts`:

Register (`POST /webhooks`), lines 30-34:

```ts
r.post('/webhooks', async (c) => {
  const { workspace } = c.get('auth');
  // A webhook tails the whole activity feed to an arbitrary URL, so registering
  // one is an admin/integration action - not something a viewer key may do.
  requireRole(c, 'admin');
```

Delete (`DELETE /webhooks/:id`), lines 59-61:

```ts
r.delete('/webhooks/:id', async (c) => {
  const { workspace } = c.get('auth');
  requireRole(c, 'admin');
```

`requireRole` (`apps/coworking-api/src/lib/authz.ts:30-36`) throws 403 when the
member's role rank is below `admin` (rank 2). `viewer`=0, `member`=1, so a viewer
or member key is rejected. The fix is present and correct.

Two supporting facts confirm the surface around the fix is also clean:

- **No webhook mutation escapes the gate.** The router only exposes
  `POST /webhooks`, `GET /webhooks`, `DELETE /webhooks/:id`
  (`webhooks.ts:30,53,59`). There is no `PATCH` route, so a low-privilege key
  cannot flip `enabled` or rewrite `url`/`events` on an existing hook to
  re-point the sink. The webhook delivery filter is read straight from the row
  (`services/webhooks.ts:42`); the only way to change it is via the admin-gated
  create/delete.
- **The webhook secret is never leaked on read.** `serializeWebhook`
  (`apps/coworking-api/src/lib/serialize.ts:282-293`) omits `secret`. `GET
  /webhooks` (`webhooks.ts:53-57`) returns only the serialized form, so listing
  webhooks (no role gate - read access) does not expose the HMAC secret. The
  secret is returned exactly once, inline at creation (`webhooks.ts:50`), which
  is the intended one-time reveal.

## 3. Sibling exfiltration hunt

I swept every router for the same shape of bug: a low-privilege key (viewer /
member) that can read the feed wholesale, register an outbound sink, or redirect
workspace data. Method-by-method gate inventory (`grep` of
`requireRole`/`requireScope` across `src/routes` + per-route read of each
outbound mechanism):

| Outbound / sensitive surface | Route | Gate | Verdict |
|---|---|---|---|
| Webhook register/delete | `webhooks.ts:30,59` | `requireRole('admin')` | gated (the fix) |
| Automation create/patch/delete (`add_comment`/`create_task` action sinks) | `automations.ts:59,93,114` | `requireRole('admin')` | gated |
| Member create | `workspaces.ts:173` | `requireRole('admin')` | gated |
| API-key issue / revoke | `workspaces.ts:217,247` | `requireRole('admin')` | gated |
| Workspace settings (rename / allowReset / DoD) | `workspaces.ts:127` | `requireRole('owner')` | gated |
| Reputation pending/ack (ERC-8004 bridge, cross-member agent data) | `reputation.ts:35,95` | `requireScope('admin')` | gated |
| Project/workspace reset + seed-demo (destructive) | `reset.ts:52-53` | `requireRole('admin')` AND `requireScope('admin')` AND `allowReset` | gated |
| Activity feed read (`GET /activity`, `GET /stream`) | `activity.ts:19,39` | auth only (any valid key) | by-design read, see F1 |
| Task comment (data-egress via comment body) | `tasks.ts:1206` | auth only (viewer may comment) | by-design, matches role matrix |

The destructive/outbound write sinks are all gated at `admin` or above. No
sibling of the original "viewer registers an outbound sink" bug exists - the
automation engine (the other mechanism that can POST a comment or spawn a task
as an action) is admin-gated too.

What remains is one consistency gap in *how* the gates are enforced, plus two
low/informational notes.

### F1 - Activity feed is readable by any authenticated key (incl. viewer) - INFORMATIONAL, by design

`GET /activity` (`activity.ts:19-36`) and `GET /stream` (`activity.ts:39-58`)
are mounted behind `authMiddleware` only - no role gate. A `viewer` key can read
or hold open an SSE tail of the entire workspace feed.

This is **intended**: the role matrix in `authz.ts:1-9` states `viewer -> read +
comment only`, and the blackboard feed is a read surface. The original finding
was never about *reading* the feed with a legitimate key - it was about a viewer
*registering an outbound sink* so data leaves to a third party without an admin
ever provisioning it. That vector is closed.

- **Location:** `apps/coworking-api/src/routes/activity.ts:19,39`
- **Severity:** low / informational (matches the documented role contract)
- **Scoping is correct:** both queries pin `workspaceId = workspace.id`
  (`activity.ts:25,48`) and the optional `projectId` filter is ANDed on top
  (`activity.ts:26`), so a viewer cannot pass a foreign `projectId` to read
  another workspace's feed. No cross-tenant leak.
- **Recommendation:** none required. If feed-read should ever be tightened, do it
  by minting viewer keys with a reduced scope and adding `requireScope('read')`
  - but that is a product decision, not a vulnerability.

### F2 - Webhook / member / key / automation gates check member ROLE, not API-key SCOPE - LOW (defense-in-depth gap / inconsistency)

The auth model has two independent axes (documented in `authz.ts:1-9`): the
member's `role` (`requireRole`) and the API key's `scopes` (`requireScope`),
and the comment says *"both must pass for sensitive actions."* In practice only
two routers enforce both:

- `reset.ts:52-53` - `requireRole('admin')` AND `requireScope('admin')`
- `reputation.ts:35,95` - `requireScope('admin')`

Every other sensitive mutation - including the webhook fix - gates on
`requireRole` **only**:

- `webhooks.ts:34,61` - `requireRole('admin')`, no `requireScope`
- `workspaces.ts:173,217,247` - member create, key issue, key revoke: role only
- `automations.ts:59,93,114` - role only

Consequence: an API key issued to an `admin`-role member but scoped down to
`['read']` (the `POST /keys` route accepts an arbitrary `scopes` array -
`workspaces.ts:211-215,240`) would still pass `requireRole('admin')` and be able
to register a webhook sink, create members, or issue *new* keys. The key's
scope - the mechanism meant to *narrow* what a given credential can do
independent of the member's role - is silently ignored on these routes.

This is **not** a viewer-exfil regression: a viewer-role member still cannot
register a webhook regardless of scope, so the 2026-06-20 fix is intact. It is a
defense-in-depth gap: the "scoped-down key" containment promised by the
`requireScope` half of the model is not delivered on the webhook/admin routes,
and the `reset`/`reputation` routes set a precedent that the others don't follow.

- **Location:** `apps/coworking-api/src/routes/webhooks.ts:34,61`;
  `workspaces.ts:173,217,247`; `automations.ts:59,93,114`. Contrast with
  `reset.ts:52-53` and `reputation.ts:35,95`.
- **Severity:** low (requires an already-privileged admin-role member; the role
  gate still blocks viewers/members). It is a latent escalation surface the day
  someone starts issuing reduced-scope keys to admins expecting them to be
  contained.
- **Recommendation:** add `requireScope('admin')` alongside `requireRole('admin')`
  on the webhook register/delete, member-create, and key issue/revoke routes, to
  match `reset.ts`. One line per route, e.g. in `webhooks.ts`:

  ```ts
  requireRole(c, 'admin');
  requireScope(c, 'admin'); // scope must also permit it - matches reset/reputation
  ```

  This makes the "both must pass" contract in `authz.ts` actually hold for the
  outbound-sink routes, so a deliberately scope-limited key cannot register a
  webhook even if its member is an admin.

### F3 - Wide-open CORS on every route - LOW / INFORMATIONAL

`server.ts:36` applies `app.use('*', cors())` with no `origin` allowlist, so any
web origin may call the API. Because auth is a `Bearer` API key in the
`Authorization` header (not a cookie or session - `middleware/auth.ts:17-19`),
an open CORS policy does **not** let a malicious page ride a victim's ambient
credentials: the browser will not attach the bearer token automatically. So this
is not a usable exfil path today.

- **Location:** `apps/coworking-api/src/server.ts:36`
- **Severity:** low / informational
- **Recommendation:** optional hardening - set an explicit `origin` allowlist on
  `cors()` for the known web front-ends so the surface is least-privilege if the
  auth model ever moves to cookies. No action needed for the bearer-token model.

## 4. Surfaces confirmed clean (evidence)

- **MCP bridge introduces no new sink.** `mcp/server.ts:54-69` forwards
  `tools/call` to the in-process REST API carrying the caller's `authorization`
  header (`server.ts:76-87`), so every MCP tool re-enters the same
  `authMiddleware` + `requireRole`/`requireScope` checks. There is zero authz
  duplicated or bypassed. The destructive reset commit path is deliberately
  REST-only and not exposed as an MCP tool (`mcp/tools.ts:339-350`,
  `reset.ts:1`). `tools/list` and `initialize` are open for discovery but expose
  no data.
- **Webhook secret never serialized** - `serialize.ts:282-293` (see section 2).
- **Cross-tenant isolation on the feed** - every activity query pins
  `workspaceId` (`activity.ts:25,48`; `services/webhooks.ts` matches hooks by
  `act.workspaceId` at `:33-39`). A key cannot read or redirect another
  workspace's data.
- **`GET /me`** returns only the caller's own member row, never others, never the
  key secret (`workspaces.ts:109-112`).

## 5. Summary

- The 2026-06-20 HIGH viewer-exfil fix **holds**: webhook register/delete are
  gated behind `admin` role, the secret is never leaked on read, and there is no
  PATCH route to re-point an existing hook.
- **No new HIGH/MED sibling exfil path found.** All outbound write sinks
  (webhooks, automations, member/key creation, reputation bridge, reset) are
  gated at `admin`/`owner`.
- Three low/informational findings: F1 (feed read by viewer - by design),
  F2 (role-only gating ignores key scope on the webhook/admin routes - a
  defense-in-depth inconsistency vs. `reset`/`reputation`; recommend adding
  `requireScope('admin')`), F3 (open CORS - inert under bearer-token auth).

Findings: 0 high, 0 medium, 3 low/informational.
