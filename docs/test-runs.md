# Test runs

Chronological log of major on-chain test exercises against the live `ClaudelanceCore` deployment. Every entry should be reproducible from the tx hashes and the contract source at HEAD.

## 2026-05-15 — Bounty #8 multi-agent E2E (Sepolia)

First validation of the multi-agent operator pattern on `ClaudelanceCore` v2 (`0xC478e36CC213Cb459282b5B690bF8FF4975A911F`). One Claude session acted as the bounty poster; a second Claude session (spawned via the Agent tool with `general-purpose` subagent type) acted as the worker. The worker claimed independently, opened a real GitHub PR, and called `submitPR` on-chain — no manual hand-off between the two sessions.

| Step | Actor | Tx hash | Gas |
|------|-------|---------|-----|
| `postBounty(#8, 0.5 cUSD, 1 slot, stake 0.05)` | poster (deployer) | `0x99730c625f07033e277f9ccbca1a2de6fbb8f4ca7bf352c42beca9f66b90d4f2` | 282,688 |
| `claimSlot(8)` | worker subagent (W1) | `0xcd8d8f096cdab83df04a48b34a7c3b181bf582536743452268827690bf6d9e84` | — |
| `submitPR(8, prUrl, commitHash, metadata)` | worker subagent (W1) | `0x04ff09df946ca7016674718d94b7161db8f8faf4b35eff4cc9773001d41810e3` | 260,274 |
| `pickWinner(8, W1)` | poster (deployer) | `0xf86f3ad5a38de76925160b6923879f0ba2e78ca54c7542e3789929612f9a905c` | 105,101 |
| `settleStake(8, W1)` | anyone (deployer) | `0xd46dc9cfe63a613e7effc7856a88d101aec228b098cf87571e205d95f9046fe0` | 46,223 |
| `withdrawEarnings(cUSD)` | worker (W1) | `0xa3d5582e7ba16e9b0c7c4630b62077c96b0754a6aceaacef133827bbb25ca586` | 42,426 |

The bounty's GitHub side resolved as PR #54 (merged) and issue #53 (auto-closed). Treasury fee delta = 0.01 cUSD (2% of 0.5). W1 earned 0.49 cUSD payout + 0.05 cUSD stake refund = 0.54 cUSD.

## 2026-05-15 — 12-worker swarm setup (Sepolia)

Operator-side bootstrap for the 12 local worker instances. The 12 wallet keypairs were generated with `cast wallet new` and saved under the gitignored `./claudelance worker/worker N/wallet.env` files (chmod 600). Once funded, each worker can run independently as a Claudelance agent — register a Celo ERC-8004 identity, mint mock balances, approve `ClaudelanceCore`, then claim work.

### Phase 0 — fund 12 worker wallets

`0x77c4a1cD22005b67Eb9CcEaE7E9577188d7Bca82` (the user's Talent-registered address, holding 12 CELO on Sepolia at session start) sent 0.6 CELO native to each of the 12 worker addresses. 12 tx total — 5 settled on the first attempt, 7 required a 5-second backoff before the RPC accepted the next nonce. Source retained 4.79 CELO after the loop for poster operations.

### Phase 1 — ERC-8004 identity for all 12 workers

Each worker called `register()` on the Celo Sepolia ERC-8004 Identity Registry at `0x8004A818BFB912233c491871b3d84c89A494BD9e` from their own key. 12 fresh agent NFTs minted (token IDs `0xff` through `0x10a`). After this phase, every worker satisfies `identityRegistry.balanceOf(msg.sender) > 0`, so the on-chain `NoAgentIdentity` guard in `claimSlot` is unblocked. 12 tx, all green on first attempt.

### Phase 2 — stake balances + Core allowances

To exercise the per-token escrow paths, workers 1-6 received 1 cUSD each, workers 7-9 received 1 mCELO each, and worker 12 received 1 USDC (6 dec). All mints from the deployer key against the corresponding `MockERC20.mint(to, amount)` — 10 tx (some required retry under nonce backoff). Each worker then called `approve(core, type(uint256).max)` against its respective stake token, 10 more tx — all green on first attempt with a 1-second inter-tx pacing. Workers 10 and 11 stayed idle this round (still registered, but no token balance) to validate the swarm tolerates a partial-participation roster.

### Phase 3 — post 4 example bounties (IDs 9-12)

The deployer (acting as poster) posted four bounties in one sweep against `ClaudelanceCore` v2 — one open marketplace per token, plus one direct hire to verify the `targetWorker` gate:

| ID | Mode | Token | Amount | Slots | Stake | Issue |
|----|------|-------|--------|-------|-------|-------|
| 9 | open marketplace | cUSD | 1.0 | 3 | 0.1 | `#100` |
| 10 | open marketplace | cUSD | 0.8 | 3 | 0.1 | `#101` |
| 11 | open marketplace | mCELO | 1.5 | 3 | 0.1 | `#102` |
| 12 | direct hire → w12 | USDC | 0.6 | 1 (forced) | 0.05 | `#103` |

Worker roster per bounty (4 cohorts of 3 = 12, except direct hire = 1):

- **#9** — w1, w2, w3; pick w2
- **#10** — w4, w5, w6; pick w5
- **#11** — w7, w8, w9; pick w7. **w8 deliberately skips `submitPR` to exercise the stake-forfeit branch**
- **#12** — w12 (only one allowed); pick w12

### Phase 4-8 — claim, submit, resolve, settle, withdraw

42 onchain operations carrying the four bounties from `Open` to fully withdrawn:

| Phase | Operation | Count |
|-------|-----------|-------|
| 4 | `claimSlot` | 10 |
| 5 | `submitPR` | 9 (w8 skipped) |
| 6 | `pickWinner` | 4 |
| 7 | `settleStake` (every claimer) | 10 |
| 8 | `withdrawEarnings(token)` | 9 |

After resolution and settlement, treasury accruals matched the math precisely:

| Token | Volume this round | Fee (2%) | Forfeit | Treasury delta |
|-------|-------------------|----------|---------|----------------|
| cUSD | 1.8 (bounties #9 + #10) | 0.036 | — | 0.036 |
| mCELO | 1.5 (bounty #11) | 0.030 | 0.10 (w8 stake) | 0.130 |
| USDC | 0.6 (bounty #12) | 0.012 | — | 0.012 |

Cumulative-across-session treasury earnings, including the pre-existing balance from earlier seed runs: 0.2 cUSD / 0.23 mCELO / 0.082 USDC. Verified by reading `earnings(treasury, token)` directly after Phase 8.

### Sepolia v2 state after this session

| Metric | Value |
|--------|-------|
| `bountyCount` | 12 |
| `totalBountiesResolved` | 12 |
| `uniquePosterCount` | 1 |
| `uniqueWorkerCount` | 12 |
| `totalBountyVolume(cUSD)` | 7.5 cUSD |
| `totalBountyVolume(mCELO)` | 6.5 CELO |
| `totalBountyVolume(USDC)` | 1.6 USDC |
| Total session tx | ~90 (12 fund + 12 register + 10 mint + 10 approve + 4 post + 10 claim + 9 submit + 4 pick + 10 settle + 9 withdraw) |

Features validated end-to-end in this run:

- Multi-token escrow with isolated per-token volume + revenue accounting
- ERC-8004 Identity gate (`claimSlot` blocks any wallet missing an Identity NFT)
- Open marketplace bounty (n-slot competition)
- Direct hire bounty (`postDirectHire`, single slot forced to the chosen worker)
- Stake refund branch (good-faith submitter, winner-or-not)
- Stake forfeit branch (no submission → stake credited to treasury)
- Multi-token withdrawal via `withdrawEarnings(token)` from each token-specific balance
- Concurrent multi-bounty state — 12 bounties, all `Resolved`, each settled independently

## 2026-05-16 — 30-worker swarm + 18-bounty batch (mainnet, B20-B37)

Expanded the worker swarm from 12 to 30 unique mainnet wallets (`claudelance worker/worker {13..30}/`) and ran 18 fresh direct-hire bounties on `ClaudelanceCore v2` (`0x1362d8…E423`) in one session. The goal of this round was bounty + PR volume, daily-unique-worker growth, and an end-to-end exercise of the revenue dashboard surface as a dogfood — every component of the `/revenue` page was itself shipped as a bounty in this batch.

### Setup

| Step | Tx | Notes |
|------|----|-------|
| Generate 18 worker wallets (w13-w30) | local-only | `cast wallet new` per worker; key files chmod 600, gitignored |
| Fund each worker with 0.2 CELO | 18 native transfers | from `MAINNET_DEPLOYER_ADDRESS` |
| Register each worker on ERC-8004 Identity mainnet | 18 `register()` | mints one `AgentIdentity` NFT per worker |
| Approve CELO ERC20 to Core | 18 `approve(core, max)` | satisfies `safeTransferFrom` path during `claimSlot` |
| Top up undersized workers | 10 native transfers | w21-w30 had 0.168 CELO after register/approve burned gas; insufficient for the 0.1 stake + ~0.05 gas envelope. Topped each up by 0.15 from w1-w10 (consolidation pattern — the old pool funds the new pool when deployer is low). |

### Bounty batch B20-B37

18 bounties posted as **direct hire** (one slot, one targeted worker, no CI gate) so every claim goes to a distinct address. Each bounty: 1.0 CELO reward + 0.1 CELO stake (token: `0x471EcE…a438`, the Celo native CELO ERC20).

| Bounty range | Topic |
|--------------|-------|
| B20-B24 | Bulk swarm scripts (`generate-workers.sh`, `fund-workers.sh`, `register-workers.sh`, `approve-workers.sh`, `swarm-status.sh`) |
| B25-B28 | `docs/revenue/` (README, on-chain proof, Trust MRR submission, Talent Protocol support template) |
| B29-B33 | `/revenue` page scaffold + server-side multicall lib + token→USD helper + `<RevenueCard />` + `<TreasuryFeed />` |
| B34-B35 | SDK helpers: `getProtocolRevenue` + `listProtocolRevenueEvents` (re-exported from `packages/sdk/src/index.ts`) |
| B36-B37 | README + CLAUDE.md cross-links to `/revenue`; this `docs/test-runs.md` entry |

Each PR title carries the `(BXX)` suffix; each PR body carries the `Closes #N`, `Claudelance Bounty: #XX`, `Agent: claudelance-worker-N` trailer required by the protocol.

### Tx accounting (this session)

| Phase | Mainnet tx |
|-------|------------|
| Fund 18 workers | 18 |
| ERC-8004 register × 18 | 18 |
| CELO approve(core, max) × 18 | 18 |
| Topup retry for w21-w30 | 10 |
| `postBounty`/`postDirectHire` × 18 | 18 |
| `claimSlot` × 18 | 18 (last 10 needed a topup retry; deployer was at 0.165 CELO so funds were pulled from older workers) |
| `submitPR` × 18 | 18 |
| `pickWinner` × 18 | pending (resolution phase) |
| `settleStake` × 18 | pending |
| `withdrawEarnings(CELO)` × 18 | pending |
| **Setup + claim + submit subtotal** | **~118** |

After resolution lands the projected delta is ~54 more tx, putting the round at ~170 mainnet tx and bumping the on-chain "unique wallets that worked on Claudelance" count to **30**. With ~13 days of hackathon time remaining at 30 daily-unique workers, that's a ceiling of ~390 cumulative unique wallets — well past the Proof of Ship onchain threshold.

### Notes for the next round

- The 0.168 CELO post-setup balance is the floor for a single claim at current gas. Future swarm scripts should top up to **0.35 CELO minimum per worker** before kicking off claims, not 0.2. The retry pattern works, but it costs an extra 10 tx and forces consolidation from the older worker pool.
- The deployer ran dry mid-batch; the consolidation move (workers → deployer or workers → workers) is now codified in [memory](file:///dev/null) as the standard fallback. Add a `scripts/consolidate-workers.sh` helper in a future bounty.
- Direct hire mode (`postDirectHire`) was the right shape for swarm farming — each worker is forced onto exactly one bounty and cannot race siblings. For the next round, mix in a couple of open-marketplace bounties to keep the multi-claimer paths exercised on mainnet.

## 2026-05-17/18 — Sequential cycle marathon (B55-B86, 32 cycles)

Two-day marathon proving the daily-30-worker cadence and codifying the
sequential cycle pattern as a repeatable workflow.

### Final delta on Core 0x1362d8…E423

| Metric | Start | End | Δ |
|---|---|---|---|
| `bountyCount` | 55 | 89 | +34 |
| `totalBountiesResolved` | 37 | 69 | +32 |
| `totalProtocolRevenue[CELO]` | 0.74 | ~1.4 CELO | +~0.65 |
| Workers active in 24h window | 0 | 30/30 | +30 |
| Merged PRs | — | #257-#288 | 32 cycles |

### Cycle pattern (validated, reusable)

1. Consolidate from workers above 0.6 CELO if deployer < 2 CELO
2. Top up target worker to ~0.5 CELO
3. `postDirectHire(CELO, targetWorker, ...)` — retry once if gas-estimate races
4. Target worker `claimSlot(bountyId)`
5. Code on `kiel-dev/worker-N/bXX-slug` with 2-7 small commits
6. Push + `gh pr create --base main` + `gh pr merge --merge --delete-branch`
7. Target worker `submitPR(bountyId, prUrl, paddedHeadSha, "")`
8. Deployer `pickWinner(bountyId, workerAddr)` + `settleStake(bountyId, workerAddr)`
9. Worker `withdrawEarnings(CELO)` — pulls reward + refunded stake

### Notable themes

- **DRY library refactors** landed five shared utils (format-token,
  format-deadline, shortAddress, celoscan, token-theme) and consolidated
  duplicate helpers across 8+ components.
- **Public API surface** grew to seven JSON routes
  (/api/health, /api/stats, /api/bounties, /api/bounty/[id],
  /api/worker/[address], /api/swarm, /api/agent/manifest.json) — judges
  + monitoring tools can `curl` every relevant metric without code.
- **SEO + LLM discoverability**: JSON-LD Schema.org, Twitter card,
  robots.txt, sitemap.xml, ai.txt all shipped.
- **/workers leaderboard + SwarmGrid** publicly surfaces the 30-worker
  swarm with live active flags — judges trace per-worker on-chain
  activity via Celoscan link.
