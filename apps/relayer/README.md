# claudelance-relayer

The always-on protocol keeper behind Claudelance's ERC-8004 agent (agentId 9144).
It does two jobs against the `ClaudelanceCoreV3` proxy on Celo:

1. **CI attestation relayer.** A signed GitHub webhook arrives, the keeper maps
   the run's pull request to the on-chain `deliverableUrl` recorded by
   `submitDeliverable`, and calls `attestCI(bountyId, worker, passed)` for
   bounties that require CI and whose task type supports it (code, type 0).
   The PR url is the join key because `deliverableHash` is worker-chosen
   (keccak256 of content or a padded commit SHA), so a padded-SHA match is only
   a fallback. Runs from forked PRs carry no `pull_requests` and are not matched.
   This is what makes open-mode winner selection trustless.
2. **Settlement keeper.** A heartbeat scans every bounty and runs the
   permissionless calls that close the lifecycle without a human:
   `settleStake(bountyId, worker)` for resolved or cancelled bounties with a
   locked stake, `cancelExpired(bountyId)` once a bounty passes its
   `deadline + RESOLUTION_GRACE_PERIOD`, and `attestReputation(bountyId,
   agentId)` (v3.1) to write the winner's +1 ERC-8004 feedback. The winner's
   agentId is resolved from Identity Registry mint logs, cached for the
   process lifetime, and re-verified via `ownerOf` before every send; workers
   whose identity cannot be resolved are skipped and logged, never retried in
   a loop.

The keeper only ever issues calls that an on-chain guard would accept, so a tick
never queues a transaction that would revert.

## Status

`DRY_RUN=true` is the default: every action is computed and logged, nothing is
broadcast, and no signing key is needed. Set `DRY_RUN=false` with a funded
`RELAYER_PRIVATE_KEY` to let it sign. Under the current direct-hire policy new
bounties carry `ciRequired=false`, so the CI path is dormant and the settlement
keeper is the part doing real work.

## Run

```bash
pnpm install
pnpm --filter claudelance-relayer dev      # tsx watch, dry-run on Sepolia
```

Production build:

```bash
pnpm --filter claudelance-relayer build
pnpm --filter claudelance-relayer start
```

## Configuration

Copy `.env.example` to `.env`. Every value has a safe default; the only ones
that matter for a live deploy are `RELAYER_NETWORK`, `DRY_RUN`,
`RELAYER_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `RELAYER_NETWORK` | `sepolia` | `sepolia` or `celo` (mainnet). Resolves to the v3 proxy deployment. |
| `RELAYER_RPC_URL` | public forno | RPC override. |
| `RELAYER_PRIVATE_KEY` | unset | Signing key. Required only when `DRY_RUN=false`. |
| `GITHUB_WEBHOOK_SECRET` | unset | HMAC secret for `X-Hub-Signature-256`. Webhook returns 503 until set. |
| `DRY_RUN` | `true` | `true` logs actions without broadcasting. |
| `PORT` | `8787` | HTTP port for the webhook + health server. |
| `KEEPER_INTERVAL_MS` | `300000` | Settlement scan interval. |
| `EVENTS_FROM_BLOCK` | `0` | First block scanned for `DeliverableSubmitted`. Set to the v3 proxy deploy block on mainnet. |

## HTTP surface

| Route | Purpose |
|-------|---------|
| `GET /` | Agent identity + current config. |
| `GET /health` | Liveness probe. |
| `POST /webhooks/github` | GitHub `workflow_run` / `check_suite` webhook. Rejects unsigned bodies with 401. |

## Production deployment (Railway)

The service ships as a Docker image (`apps/relayer/Dockerfile`, build context =
repo root, config in `railway.json`): multi-stage pnpm build, standalone
production tree via `pnpm deploy`, runs as the non-root `node` user, no env
files in the image. Railway health-checks `/health` and restarts on failure.

Operational rules:

- `RELAYER_PRIVATE_KEY` lives only in Railway service variables (encrypted at
  rest, masked in build logs). It is never committed, never baked into the
  image, and never printed by the service.
- The relayer wallet is deliberately low-value. Keep roughly 1-2 CELO on it;
  the keeper logs `keeper.low-balance` when it drops under 0.3 CELO.
- Rollout order: deploy with `DRY_RUN=true` and no key, watch a few
  `keeper.tick` / `keeper.dry-run` lines, then set the key and flip
  `DRY_RUN=false`.
- Every write is simulated first (`eth_call`) so a revert never burns gas, and
  pinned to the live gas price (Celo's base fee floats around 200 gwei).
- Writes are sequential and wait for the receipt before the next send, so the
  keeper never races its own nonce and is safe even if two instances overlap
  (the on-chain guards make duplicate actions revert in simulation, not on
  chain).

## Tests

```bash
pnpm --filter claudelance-relayer test       # pure decision + webhook logic
pnpm --filter claudelance-relayer typecheck
```

The settlement and attestation logic lives in `decisions.ts` as pure functions,
so the rules are tested without a chain. `chain.ts` is the only module that
talks to the network.
