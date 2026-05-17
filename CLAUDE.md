<p align="center">
  <img src="https://raw.githubusercontent.com/yeheskieltame/claudelance/main/assets/logo.png" alt="Claudelance" width="180" />
</p>

# Claudelance — Working Notes for Claude

[![sdk npm](https://img.shields.io/npm/v/@yeheskieltame/claudelance-sdk.svg?label=sdk&color=cb3837)](https://www.npmjs.com/package/@yeheskieltame/claudelance-sdk)
[![sdk downloads](https://img.shields.io/npm/dt/@yeheskieltame/claudelance-sdk.svg?label=sdk%20downloads)](https://www.npmjs.com/package/@yeheskieltame/claudelance-sdk)
[![types npm](https://img.shields.io/npm/v/@yeheskieltame/claudelance-types.svg?label=types&color=cb3837)](https://www.npmjs.com/package/@yeheskieltame/claudelance-types)
[![types downloads](https://img.shields.io/npm/dt/@yeheskieltame/claudelance-types.svg?label=types%20downloads)](https://www.npmjs.com/package/@yeheskieltame/claudelance-types)

> The first onchain marketplace where idle Claude Code subscriptions earn cUSD, CELO, or USDC by solving GitHub bounties.
> Hackathon: Celo Proof of Ship #8 (May 4-29, 2026). Submission Day 7 (May 21).
> Full spec lives in `Blueprint.md`. Live deployment records: `contracts/deployments/celo-{mainnet,sepolia}.json`.

## Locked decisions (do not re-litigate)

| Topic | Decision |
|-------|----------|
| Project name | `claudelance` (npm names: `@yeheskieltame/claudelance-*`, matches GitHub owner for Packages registry compat) |
| GitHub host | `github.com/yeheskieltame` (personal account, no org) |
| LLM (Phase 1) | Claude Code CLI only |
| Worker wallet | Dual mode: generate locally OR provide existing |
| Worker GitHub auth | Operator's Personal Access Token |
| Worker identity | ERC-8004 Identity NFT required to `claimSlot` (Celo deployed registries) |
| Token whitelist | cUSD + CELO ERC20 + USDC; one-way `allowToken`; per-token `minBounty` mapping |
| Hire modes | **Direct-hire only as of 2026-05-17** (`postDirectHire` targeting one of the 30 local swarm workers). `postBounty` open marketplace deprecated for this hackathon after sybil patterns observed in the B38-B54 public round (e.g. cycy701/Freeman88-tch shared wallet `0xb08095…846f`). Existing public bounty PR backlog (B39-B51 round 2) is being resolved off-protocol or via onboarded winners; no new public bounty issues. |
| Stake policy | `stake > 0` required on ALL bounties (open + direct) |
| Bidding | Poster-defined max slots, merit-based winner (open mode) or pre-selected worker (direct) |
| Protocol fee | 2% on resolved bounties, per-token accounting |
| Submission method | Unified: GitHub PR (all bounty types) |
| Off-chain config | `claudelance/bounties-registry` (JSON), keccak256 hash onchain |
| Phase 1 UI bounty types | Code only |
| Smart contract bounty types | 0-255 (future-proof) |
| Hackathon tracks | MiniApps + AI Powered Apps & Agents (dual entry) |
| npm strategy | 2 packages by Day 7 + 4 more Day 9-15 |
| Contract base | `ReentrancyGuard + Ownable2Step + Pausable` (immutable, no upgrade proxy) |
| Stake settlement | Pull pattern via `settleStake(bountyId, worker)` — `pickWinner` stays O(1) |
| Treasury payout | Pull pattern via `earnings[treasury][token]` — no push transfers to recipients |
| Admin key rotation | 2-day timelock + 14-day validity window on `treasury` / `ciRelayer` rotation |
| Mainnet wallet topology | 4 distinct keys — `Deploy.s.sol` aborts on chainid 42220 if any collide. Owner is a Safe multisig (threshold 2). |
| Mainnet deployer | Must be the user's Talent-registered address (`0x77c4a1c…`) for Celo Proof of Ship attribution |
| Mainnet v2 status | **LIVE** at `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`, Celoscan-verified, allowToken applied for cUSD/CELO/USDC |

## Repo structure

| Path | Status | Notes |
|------|--------|-------|
| `contracts/` | v2 LIVE mainnet + Sepolia | Foundry, Solidity 0.8.24, OZ v5 |
| `apps/web/` | needs v2 wire-up | Next.js 15 MiniPay app (landing renders; mainnet stats wiring pending) |
| `apps/relayer/` | planned (Day 5) | Hono + SQLite indexer + CI verifier |
| `packages/worker/` | planned (Day 4) | `@yeheskieltame/claudelance-worker` Claude Code CLI |
| `packages/types/` | v0.3.0 LIVE on npmjs + GH Packages | `@yeheskieltame/claudelance-types` shared ABI + types (mainnet + Sepolia) |
| `packages/sdk/` | v0.3.0 LIVE on npmjs + GH Packages | `@yeheskieltame/claudelance-sdk` agent client |
| `packages/contracts/` | planned (Day 9) | `@yeheskieltame/claudelance-contracts` ABI artifacts |
| `packages/react/` | planned (Day 13) | `claudelance-react` hooks |
| `packages/cli/` | planned (Day 15) | `@yeheskieltame/claudelance-cli` (binaries `claudelance` and `cln`) |

Supplementary repos under `github.com/yeheskieltame/`: `bounties-registry` (Phase 1 JSON spec hashed on-chain), `content-submissions`, `video-submissions` (Phase 2).

## Tech stack pinned versions

- Solidity `0.8.24`, Foundry nightly, OpenZeppelin `^5.0.0`, forge-std `^1.9.0`
- Next.js `15.x` (App Router), React `19.x`, TS `5.x`, Tailwind `3.4.x`, shadcn/ui
- viem `^2.21.0`, wagmi `^2.12.0`, @tanstack/react-query `^5.x`, zod `^3.x`
- Worker: Node `>=20`, @octokit/rest `^21.x`, simple-git `^3.x`, commander `^12.x`, inquirer `^10.x`, bip39 `^3.x`
- Relayer: Hono `^4.x`, better-sqlite3 `^11.x`, @octokit/webhooks `^13.x`, pino `^9.x`

## Networks, tokens, registries

- Prod: Celo Mainnet — `https://forno.celo.org`
- Dev: Celo Sepolia — `https://forno.celo-sepolia.celo-testnet.org/`
- Mainnet token canonical addresses:
  - cUSD: `0x765DE816845861e75A25fCA122bb6898B8B1282a`
  - CELO ERC20: `0x471EcE3750Da237f93B8E339c536989b8978a438`
  - USDC: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- ERC-8004 (Celo-deployed):
  - Mainnet Identity: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
  - Mainnet Reputation: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
  - Sepolia Identity: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
  - Sepolia Reputation: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- Faucet: https://faucet.celo.org/celo-sepolia

## Smart contract surface (`ClaudelanceCore.sol` v2)

Single contract — `ReentrancyGuard + Ownable2Step + Pausable`. Public mutating fns:
- Poster (open): `postBounty(token, ...)`
- Poster (direct hire): `postDirectHire(token, targetWorker, ...)` — forces `maxSlots=1`, `ciRequired=false`
- Poster (any): `pickWinner`, `cancelExpired`
- Worker: `claimSlot` (ERC-8004 gated + targetWorker gated), `submitPR`, `withdrawEarnings(token)`
- Anyone (permissionless after resolution): `settleStake(bountyId, worker)`
- Relayer: `attestCI`
- Admin (immediate): `allowToken(token, minAmount)` (one-way), `setMinBounty(token, amount)`
- Admin (2-day timelock + 14-day validity window): `proposeTreasury`, `applyTreasury`, `cancelPendingTreasury`, `proposeCIRelayer`, `applyCIRelayer`, `cancelPendingCIRelayer`, `pause`, `unpause`, `rescueERC20`

Constants: `PROTOCOL_FEE_BPS = 200` (2%), `MAX_SLOTS = 20`, `MIN_DEADLINE = 1 days`, `MAX_DEADLINE = 14 days`, `RESOLUTION_GRACE_PERIOD = 3 days`, `ADMIN_TIMELOCK = 2 days`, `PROPOSAL_VALIDITY_WINDOW = 14 days`. `MIN_BOUNTY` is now per-token (admin-set via `allowToken` / `setMinBounty`).

Stats are per-token: `totalBountyVolume[token]`, `totalProtocolRevenue[token]`. Globals: `totalBountiesResolved`, `uniquePosterCount`, `uniqueWorkerCount`, `bountyCount`, `bountyCountByType[type]`. View `getStats(token)` returns the 5-tuple for a single token; frontend aggregates across tokens via price oracle.

Per-bounty tx count: posting + N claims + N submits + N attests + pickWinner + N settleStake + worker withdraws. Poster's hot path (`pickWinner`) stays O(1).

### v2 Mainnet deployment (LIVE 2026-05-15)

| Role | Address |
|------|---------|
| ClaudelanceCore v2 (verified) | `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423` on chain 42220 |
| cUSD | `0x765DE816845861e75A25fCA122bb6898B8B1282a` (Mento canonical) |
| CELO ERC20 | `0x471EcE3750Da237f93B8E339c536989b8978a438` |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` (Circle, Celo native) |
| ERC-8004 Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (`AgentIdentity` / `AGENT` / IERC721) |
| ERC-8004 Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| owner | `0xe9Fc48f315fD4E989637fAcC29AaF2717E19f7F0` (Safe multisig, threshold 2) |
| treasury | `0xCC0cCac212999612BdDdEb607B33CC1a46F8A401` |
| ciRelayer | `0x1fEDda23c2945D59f3929e6C463cF685aC077ad5` |
| deployer | `0x77c4a1cD22005b67Eb9CcEaE7E9577188d7Bca82` (Talent Protocol registered) |

### v2 Sepolia deployment (LIVE 2026-05-14, dev/staging)

| Role | Address |
|------|---------|
| ClaudelanceCore v2 (verified) | `0xC478e36CC213Cb459282b5B690bF8FF4975A911F` on chain 11142220 |
| MockCUSD | `0xeB9595f4d14A4AEB23cc535007c973e50F1307E7` (min 0.5 cUSD) |
| MockCELO | `0x68128f321E01C2388628c549E3a4Ea016DB01968` (min 1 CELO) |
| MockUSDC | `0x71f44190dCE495b663700A3e96909988b8fbF3F9` (min 0.5 USDC) |
| ERC-8004 Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` (Celo-deployed) |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` (Celo-deployed) |
| owner / treasury / relayer | `0x987e2ed458ddAF6f900362F94558378056dCc226` (single key, Sepolia only) |

> **Historical note:** an earlier mainnet contract at `0x775d4278Ad3f5695fbab3c3313175e9D85811AB5` (cUSD-only ABI) was deployed and verified on 2026-05-14 but never received traffic; superseded by v2 above.

## MCP / tooling installed (Day 0)

| Tool | Purpose |
|------|---------|
| celo-mcp | Chain data (balance, tx, contract, governance, staking) — Blueprint Section 13 required |
| github MCP (HTTP) | Repo/PR/issue/workflow management via natural language (OAuth on first use) |
| context7 MCP | Up-to-date docs for Next.js 15, viem, wagmi, Foundry, OpenZeppelin v5 |
| gh CLI | Local git+GitHub operations, `gh auth login` required before use |
| foundry / forge | Smart contract dev (already installed) |
| pnpm, node v25 | Monorepo + worker CLI |

Built-in skills relevant: `/security-review` (run before every contract commit), `/review` (worker PR review), `/init`.

## Submission scoring axes (always optimize for these)

1. **Onchain** — Celo mainnet tx, unique users, contract activity (target 1,945+ tx)
2. **GitHub** — commits, PRs, stars, contributions (target 150+ commits, 100+ PRs)
3. **Revenue** — value transacted + fees (target $250+ volume, $5+ fee)
4. **npm** — packages + weekly downloads (6 packages, 50+ downloads)

Eligibility gates that must pass: MiniPay-compatible (`useMiniPayDetection`), Celo mainnet deploy (verified Celoscan, **done**), Talent Protocol + KarmaGAP submission.

## Working conventions

- Treat Blueprint.md as authoritative for decisions; ask before deviating.
- Smart contracts are immutable on mainnet. Every contract diff goes through `/security-review`, Slither, and the invariant suite (`forge test --match-path "test/invariant/*"`) before commit.
- All post-Day-1 changes ship via `kiel-dev` branch, then PR, then self-review, then `gh pr merge --merge --delete-branch`. Per-file commits are preferred; per-context PRs are preferred over kitchen-sink PRs (more commits + PRs improve hackathon scoring).
- PR descriptions on worker-generated PRs MUST include: `Closes #<issue>`, `Claudelance Bounty: #<id>`, `Agent: claudelance-worker-#<id>`.
- **Bounty issue policy (2026-05-17 onward):** any new bounty starts as a `postDirectHire` on-chain call targeting one of the 30 local workers under `./claudelance worker/`. The corresponding GitHub issue is informational only (links the on-chain bountyId + repo URL + spec). NEVER add `bounty-open` / `help-wanted` labels that invite public contributors. If an external contributor self-submits a PR to a direct-hire bounty, close with a friendly explanation that the bounty is targeted; offer them a future direct-hire slot if their PR is high-quality.
- Worker rate limit: 30 GitHub req/min.
- Mainnet broadcasts go through `--verify` against Celoscan (Etherscan API V2).
- Indonesian (Bahasa) is fine in chat; code, comments, commit messages stay in English.

### v2 ABI surface (downstream tooling target)

All downstream tooling (worker CLI, frontend, relayer, SDK) targets the v2 ABI live at mainnet `0x1362d8…E423` (and Sepolia `0xC478e3…911F` for dev).

**v2 surface highlights:**
- `constructor(treasury, ciRelayer, owner, identityRegistry, reputationRegistry)`
- `postBounty(IERC20 token, ...)` — token as first arg
- `postDirectHire(token, targetWorker, ..., stake, deadline)` — forces `maxSlots=1`, `ciRequired=false`
- `withdrawEarnings(IERC20 token)` — per-token pull
- `earnings(addr, token)`, `getStats(token)`, `totalBountyVolume(token)`, `totalProtocolRevenue(token)` — per-token reads
- `allowToken(token, minBounty)` (onlyOwner, one-way) + `setMinBounty(token, amount)`
- `Bounty` struct carries `token` + `targetWorker` (4 fixed slots, reordered for packing)
- `BountyPosted`, `EarningsWithdrawn`, `ProtocolRevenueAccrued` events all carry `token` (indexed)
- Errors: `TokenNotAllowed`, `TokenAlreadyAllowed`, `NotTargetedWorker`, `InvalidStake`, `NoAgentIdentity`, `CannotRescueEscrowToken`

Owner-only mainnet actions must go through the Safe at <https://app.safe.global/home?safe=celo:0xe9Fc48f315fD4E989637fAcC29AaF2717E19f7F0>, not from a CLI key.

**Revenue surface for Talent Protocol Trust MRR:** treasury accrual is read via `totalProtocolRevenue(token)` per-token plus the indexed `ProtocolRevenueAccrued(token, amount, cumulative)` event. Dashboard at `/revenue` and submission docs at `docs/revenue/` are the canonical references — keep them in sync with mainnet treasury whenever a new bounty resolves. SDK helpers: `getProtocolRevenue` (read) + `listProtocolRevenueEvents` (event log scan).

## Critical timeline

- Day 0 (2026-05-14): admin setup + `ClaudelanceCore` v1 deploy (later superseded) + 67 unit / 4 invariant / 28 fork tests + Sepolia v2 deploy
- Day 0 late (2026-05-14): **v2 pivot — multi-token + ERC-8004 + direct hire**; v2 deployed to Sepolia; types + sdk bumped to 0.2.0; 83 tests
- Day 1 (2026-05-15): **mainnet v2 deploy** `0x1362d8…E423`, Safe `allowToken` applied for cUSD/CELO/USDC, first mainnet bounty resolved (SDK 0.3.0 fix), types/sdk republished as 0.3.0
- Day 4: publish `@yeheskieltame/claudelance-worker`
- Day 6: Vercel deploy
- Day 7 (2026-05-21): submission deadline — KarmaGAP + 15 seed bounties + 4-min demo video + pitch deck + Talent Protocol submit
- Day 8-15: sustained activity, onboard workers, publish remaining 4 npm packages
- Day 29 (2026-05-29): hackathon ends
