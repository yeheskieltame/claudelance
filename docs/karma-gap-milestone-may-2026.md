# Karma GAP - Proof of Ship #8 Milestone (May 4-29, 2026)

> Drop-in markdown for the Karma GAP milestone form. Paste the matching block into each milestone entry. Numbers anchored to 2026-05-19; refresh before submitting if dates shift.

---

## Project profile fields (one-time setup)

| Field | Value |
|---|---|
| Project name | Claudelance |
| Tagline | The first onchain marketplace where idle Claude Code subscriptions earn cUSD, CELO, or USDC by solving GitHub bounties. |
| GitHub repository | `https://github.com/yeheskieltame/claudelance` |
| Contract address | `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423` (chain 42220) |
| Verified on | `https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#code` |
| Divvi profile id | (to be filled - register at divvi.xyz, link deployer `0x77c4a1cD22005b67Eb9CcEaE7E9577188d7Bca82`) |
| Tracks | MiniApps + AI Powered Apps & Agents |

---

## Milestone 1 - Ship v2 multi-token core on Celo Mainnet

**Status:** Complete (2026-05-15)

**What was delivered**

- Deployed `ClaudelanceCore` v2 to Celo mainnet at `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`, verified on Celoscan.
- Multi-token escrow (cUSD, CELO ERC20, USDC) with one-way `allowToken` admin gate + per-token `minBounty`.
- ERC-8004 Identity gating for worker `claimSlot` (mainnet registries `0x8004A1…a432` / `0x8004BA…9b63`).
- 4-key topology: deployer `0x77c4a1c…` (Talent-registered), owner Safe `0xe9Fc48…` (threshold 2), treasury `0xCC0cCa…`, relayer `0x1fEDda…`. `Deploy.s.sol` aborts on chainid 42220 if any collide.
- Pull-pattern stake settlement (`settleStake`) and treasury payout (`earnings[treasury][token]`); poster hot path `pickWinner` stays O(1).
- 83 tests passing (unit + 4 invariant + fork). Slither + `/security-review` clean.

**Verifiable outputs**

- Tx: contract deploy `https://celoscan.io/tx/<deploy-tx>` (replace before submit)
- Verified ABI: Celoscan link above
- PR: `https://github.com/yeheskieltame/claudelance/pull/<N>` (mainnet deploy PR)

---

## Milestone 2 - Direct-hire bounty flow + worker onboarding

**Status:** Complete (2026-05-17)

**What was delivered**

- New `postDirectHire(token, targetWorker, ...)` entrypoint targeting one specific ERC-8004 worker; forces `maxSlots=1`, `ciRequired=false`. Used to run the protocol's own validation agents through the full lifecycle on mainnet.
- 30 operator-run validation agents, each holding an ERC-8004 Identity NFT, exercise the direct-hire pipeline (dogfooding - not external workers).
- Any remaining open-round PR backlog resolved off-protocol; no new public bounties posted under the open `postBounty` path during the hackathon.

**Verifiable outputs**

- Resolved bounties: 80 of 96 posted (`getStats(token)`); total bounty volume 96 CELO (CELO-denominated; cUSD/USDC volume currently 0). All operator-run validation, not third-party adoption.
- `uniqueWorkerCount` = 30 (operator-run agents); `uniquePosterCount` = 1 (the operator).
- Protocol fees accrued: 1.60 CELO (read `totalProtocolRevenue(token)`) - from validation bounties, not customer revenue.
- Direct-hire example txs: include 3-5 recent Celoscan tx links here before submit.

---

## Milestone 3 - Publish npm SDK surface

**Status:** Complete (2026-05-14, ongoing)

**What was delivered**

- `@yeheskieltame/claudelance-types@0.4.2` - TS types, ABI, deployment addresses for mainnet + Sepolia. Live on npmjs.org + GitHub Packages.
- `@yeheskieltame/claudelance-sdk@0.4.5` - viem-based agent client wrapping the v2 ABI: post / claim / submit / attestCI / pick / settle / withdraw helpers + revenue stream reads.
- Both packages: dual ESM+CJS, `sideEffects: false`, `repository.directory` pointing to monorepo subpath.
- Downloads (last 7d): sdk **59**, types **92**; lifetime 963 + 996 (read live from api.npmjs.org).

**Verifiable outputs**

- `https://www.npmjs.com/package/@yeheskieltame/claudelance-sdk`
- `https://www.npmjs.com/package/@yeheskieltame/claudelance-types`
- Combined lifetime downloads: read live from `https://api.npmjs.org/downloads/range/last-year/@yeheskieltame/claudelance-sdk`

---

## Milestone 4 - Frontend MiniApp on Celo

**Status:** Complete (2026-05-18)

**What was delivered**

- Next.js 15 App Router frontend at `apps/web/` with MiniPay detection hook + Privy connector fallback.
- Pages live: `/post` (post bounty), `/bounties` (feed), `/bounty/[id]` (claim + submit + pick winner actions), `/worker/[address]` (worker dashboard), `/revenue` (per-token protocol revenue dashboard).
- viem v2 + wagmi v2 + @tanstack/react-query against v2 ABI.
- Mobile-first; tested on MiniPay test environment.

**Verifiable outputs**

- Vercel preview URL (paste before submit)
- Screenshot bundle in `docs/screenshots/` (capture before submit)
- Lighthouse mobile score: target 85+ Performance, 100 Accessibility

---

## Milestone 5 - Talent Protocol Trust MRR integration

**Status:** In progress

**What's planned**

- `/revenue` dashboard exposes per-token `totalProtocolRevenue(token)` + `ProtocolRevenueAccrued` event log scan. Treasury accrual is the Trust MRR signal - published to `docs/revenue/`.
- SDK helpers `getProtocolRevenue` (read) + `listProtocolRevenueEvents` (event log) make the signal API-consumable.
- Talent API integration in `apps/web/`: show Builder Score badges on poster + worker profile cards using Pro account API key.

**Verifiable outputs (when done)**

- Live dashboard URL
- API integration PR
- `docs/revenue/README.md` with methodology

---

## Milestone 6 - Demo video + Talent app + KarmaGAP submission

**Status:** Scheduled for 2026-05-20 (Day 7-1)

**Deliverables**

- 4-minute demo video walking through: pitch → post bounty (MiniPay) → worker claims → PR submitted → winner picked → payout → revenue dashboard.
- Talent app project page populated, GitHub repo linked, Builder Score >100 (claim Celo Developer + GitHub + Identity credentials).
- KarmaGAP milestones 1-5 marked complete with verifiable on-chain references.

---

## Technical quality signals (for AI scorer)

- **Language distribution:** Solidity (contracts), TypeScript (sdk, types, web), with strict configs across the monorepo.
- **Test coverage:** 83 contract tests (unit + invariant + fork), forge coverage report committed.
- **CI/CD:** GitHub Actions on every PR - lint, typecheck, contract tests, frontend build.
- **Documentation:** `README.md` (pitch + status), per-package READMEs (sdk, types, contracts, web), and revenue + KarmaGAP docs under `docs/`.
- **License:** MIT across all packages and contracts.
- **Security:** OZ v5 base (`ReentrancyGuard + Ownable2Step + Pausable`), Slither + `/security-review` on every contract diff, 2-day admin timelock + 14-day validity window on treasury/relayer rotation, pull-pattern payouts.
- **Operational hygiene:** Safe multisig owner on mainnet, separate deployer / treasury / relayer keys, immutable (no upgrade proxy).

---

## On-chain metrics (report honestly)

> All on-chain activity to date is operator-run validation (`uniquePosterCount = 1`). Report it as protocol dogfooding / end-to-end validation - **not** as organic users or customer revenue.

| Metric | Value (refresh before submit) | Source |
|---|---|---|
| Bounties posted / resolved | 92 / 76 | `bountyCount()` / `getStats` resolved |
| Total bounty volume | 92 CELO | `totalBountyVolume(token)` (all CELO) |
| Protocol fees accrued | 1.60 CELO | `totalProtocolRevenue(token)` |
| Operator validation agents | 30 | `uniqueWorkerCount()` |
| Unique posters | 1 (the operator) | `uniquePosterCount()` |
| npm downloads (last 7d) | refresh live | `api.npmjs.org/downloads/point/last-week/...` |

Refresh via `cast call 0x1362d8…E423 'getStats(address)' <token>` for cUSD / CELO / USDC and sum, right before submitting.
