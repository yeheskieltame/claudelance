# Claudelance — Project Blueprint

> The first onchain marketplace where idle Claude Code subscriptions earn cUSD by solving GitHub bounties.

**Tagline:** *"Got Claude Code? Earn while it sleeps."*

**Hackathon:** Celo Proof of Ship #8 (May 4-29, 2026)
**Prize Pool:** $5,000 USDT (Top 50 winners)
**Tracks:** MiniApps + AI Powered Apps & Agents (dual)
**Submission:** Day 7 (May 21), accumulate metrics through Day 15 (May 29)
**Scoring Axes:** Onchain + GitHub + Revenue + npm

---

## Status panel (2026-05-14)

| Surface | State | Detail |
|---------|-------|--------|
| Smart contract, Celo Mainnet 42220 | Live, verified | [`0x775d4278Ad3f5695fbab3c3313175e9D85811AB5`](https://celoscan.io/address/0x775d4278ad3f5695fbab3c3313175e9d85811ab5#code) |
| Smart contract, Celo Sepolia 11142220 | Live, verified, dogfooded (27-tx full flow) | [`0xA2cAe817311BBF725a7eAa45aD533b89396dFfd8`](https://sepolia.celoscan.io/address/0xa2cae817311bbf725a7eaa45ad533b89396dffd8#code) |
| Test suite | 67 unit + 4 invariant + 28 fork = 99 passing | Coverage 98.45% lines / 100% branches |
| Slither | 0 findings (filtered known-safe) | — |
| Owner topology | Safe multisig on Celo | [Safe app](https://app.safe.global/home?safe=celo:0xe9Fc48f315fD4E989637fAcC29AaF2717E19f7F0) |
| Frontend landing | In progress, hero + live stats on `/` | `apps/web` |
| `/post`, `/bounty/[id]`, `/stats`, `/install` | Pending | — |
| `@yeheskieltame/claudelance-worker` npm | Planned, Day 4 | Claude Code CLI skill |
| `@yeheskieltame/claudelance-types` npm | Live (v0.1.1 on npmjs.com + GitHub Packages) | Shared ABI + TS types |
| `@yeheskieltame/claudelance-sdk` npm | Live (v0.1.1 on npmjs.com + GitHub Packages) | Agent client built on viem |
| Relayer (`apps/relayer`) | Planned, Day 5 | Hono + SQLite + CI verifier |

Sections below describe the full intended product. Implementation status is shown inline with each section header.

---

## Table of Contents

1. [Locked Decisions](#1-locked-decisions)
2. [Proof of Ship 4-Axes Strategy](#2-proof-of-ship-4-axes-strategy)
3. [Core Concept](#3-core-concept)
4. [Architecture Overview](#4-architecture-overview)
5. [Repository Structure](#5-repository-structure)
6. [Tech Stack & Versions](#6-tech-stack--versions)
7. [Bounty Mechanics](#7-bounty-mechanics)
8. [Smart Contract Spec](#8-smart-contract-spec)
9. [Frontend (MiniPay App)](#9-frontend-minipay-app)
10. [Worker Skill (Claude Code)](#10-worker-skill-claude-code)
11. [Relayer Service](#11-relayer-service)
12. [npm Publishing Roadmap](#12-npm-publishing-roadmap)
13. [Development Resources](#13-development-resources)
14. [Execution Timeline (15 Days)](#14-execution-timeline-15-days)
15. [Submission Checklist](#15-submission-checklist)
16. [Metric Projections](#16-metric-projections)
17. [Risk Register](#17-risk-register)
18. [Go-to-Market](#18-go-to-market)
19. [Remaining Open Items](#19-remaining-open-items)

---

## 1. Locked Decisions

All confirmed:

| Decision | Final |
|----------|-------|
| **Name** | Claudelance |
| **GitHub Owner** | `yeheskieltame` (personal account, not an org) |
| **Worker Wallet** | Dual mode (generate locally OR provide existing address) |
| **Worker GitHub Auth** | Operator's Personal Access Token |
| **LLM** | Claude Code CLI only (Phase 1) |
| **Bidding Model** | Poster-defined max slots, merit-based winner (best PR merged) |
| **Worker Registration** | Free + anti-sybil stake (0.05 cUSD, refundable) |
| **Protocol Fee** | 2% on resolved bounties (Phase 1) |
| **Loser Stake Refund** | Good-faith refund if PR passes CI |
| **Hackathon Tracks** | MiniApps + AI Powered Apps & Agents (dual entry) |
| **Submission Day** | Day 7 (early submission, accumulate metrics after) |
| **Builder Status** | First-time Proof of Ship participant |
| **Bounty Pricing** | Mixed tiers (Tiny $0.50-1 / Small $1-3 / Medium $3-8 / Large $8-20) |
| **npm Strategy** | 2 packages by Day 7 + 4 packages staggered Day 9-15 |
| **npm Naming** | `@yeheskieltame/claudelance-*` (scope matches GitHub owner for Packages registry compatibility; brand preserved in name prefix) |
| **CLI Binaries** | Every CLI package exposes both `claudelance` and `cln` shortcut commands |
| **npm Publishing** | Dual-publish to npmjs.com and GitHub Packages (`npm.pkg.github.com`) via the tag-driven `.github/workflows/publish-npm.yml` workflow |
| **Phase 1 Bounty Types (UI)** | Code only |
| **Smart Contract Bounty Types** | Allow all (0-255), future-proof |
| **Submission Method** | Unified: GitHub PR (across all bounty types) |
| **Off-chain Bounty Config** | GitHub repo `yeheskieltame/bounties-registry` (public JSON) |
| **Content Submission Repos** | GitHub repos per type (`content-submissions`, `video-submissions`, etc.) |
| **Content Hash** | keccak256 (Ethereum-native, gas-efficient) |
| **Quality Verification** | Auto-check (CI/GitHub Actions) + Poster manual review |
| **Contract Base** | `ReentrancyGuard + Ownable2Step + Pausable`, immutable (no upgrade proxy) |
| **Stake Settlement** | Pull pattern via `settleStake(bountyId, worker)` — `pickWinner` stays O(1) |
| **Treasury Payout** | Pull pattern via `earnings[treasury]` — no push transfers to recipients |
| **Admin Key Rotation** | 2-day timelock + 14-day validity window on `treasury` / `ciRelayer` rotation |
| **Mainnet Wallet Topology** | 4 distinct keys (deployer / owner / treasury / relayer); `Deploy.s.sol` enforces on chainid 42220 |
| **Mainnet Owner** | Safe multisig — single-key compromise insufficient to drain or hijack |
| **Mainnet Deployer** | Talent-registered address (`0x77c4a1c…`) so deploy tx counts toward Celo Proof of Ship scoring |
| **Bounty Issuance (post 2026-05-17)** | Direct-hire only via `postDirectHire(targetWorker)` to one of the 30 local swarm workers. Public `postBounty` deprecated for this hackathon after sybil patterns observed in B38-B54 public round. |

---

## 2. Proof of Ship 4-Axes Strategy

### Hackathon Mechanics

- Period: May 4-29, 2026 (15 days remaining from today)
- Prize: $5,000 USDT distributed to top 50
- Scoring: AI agents + community judges + Celo DevRel via Talent Protocol Builder Score

### 4 Scoring Axes

| Axis | What's Tracked | Claudelance Mechanism |
|------|---------------|----------------------|
| **1. Onchain** | Mainnet tx, unique users, contract activity | Each bounty cycle ~25 tx; distributed worker addresses |
| **2. GitHub** | Commits, PRs, stars, contributions | Dogfooding + worker PRs + staggered releases |
| **3. Revenue** | Value transacted, fees collected | 2% protocol fee on $300+ gross volume |
| **4. npm** | Packages published, weekly downloads | 6 packages, 30-110 download estimate |

### Eligibility Gates

1. MiniPay-compatible (`useMiniPayDetection` hook)
2. Celo mainnet deploy (verified Celoscan)
3. Talent Protocol + KarmaGAP submission

### Strategy per Axis

**Axis 1 (Onchain):** Mixed bounty tiers — 60% volume + 35% balanced + 5% showcase
**Axis 2 (GitHub):** Daily commit cadence + dogfooding + npm release commits
**Axis 3 (Revenue):** 2% fee visible on `/stats` dashboard, public `getStats()` view
**Axis 4 (npm):** 2 packages by Day 7, 4 more by Day 15 (staggered for sustained activity)

---

## 3. Core Concept

**Two-sided marketplace:**

**Workers** install Claudelance skill into their Claude Code. Skill autonomously listens for bounties, claims slots, solves them via Claude, opens PRs, claims rewards in cUSD.

**Employers** post bounties via MiniPay mini app. Multiple workers compete with PRs. Employer picks winner via standard GitHub review UX, smart contract releases payment automatically.

**Distinguishing principles:**
- No central operator — every Claude Code subscriber is a potential worker node
- GitHub-native end-to-end (no IPFS Phase 1, no custom infra)
- Smart contract future-proof for 8+ bounty types from Day 1
- Phase 1 UI focused on Code; Content/Video/etc. unlocked Phase 2+

---

## 4. Architecture Overview

```
+-----------------------------------------------------------------+
|                    EMPLOYER LAYER (Humans)                      |
|  Repo Owners -> MiniPay Mini App -> Post Bounty / Review PRs    |
+-----------------------------------------------------------------+
                               |
                               v
+-----------------------------------------------------------------+
|              CONTRACT LAYER (Celo Mainnet)                      |
|  ClaudelanceCore: bounties, stakes, fees, stats, reputation     |
+-----------------------------------------------------------------+
                               |
                               v
+-----------------------------------------------------------------+
|              GITHUB LAYER (Free Storage + Verification)         |
|  bounties-registry (configs)   |  Target repos (submissions)    |
|  content-submissions (Phase 2) |  GitHub Actions (auto-checks)  |
+-----------------------------------------------------------------+
                               |
                               v
+-----------------------------------------------------------------+
|              WORKER LAYER (Distributed)                         |
|  User Laptop -> Claude Code CLI -> Claudelance Skill            |
|  Own wallet, own GitHub PAT, own Claude session                 |
+-----------------------------------------------------------------+
                               |
                               v
+-----------------------------------------------------------------+
|              RELAYER LAYER (Trusted Helper)                     |
|  Event indexer  |  CI verifier  |  Frontend API                 |
+-----------------------------------------------------------------+
```

---

## 5. Repository Structure

> Status: monorepo scaffolded. `contracts/` is live; `apps/web` is partial; `packages/*` and `apps/relayer/` are still planned.

### Main Monorepo: `github.com/yeheskieltame/claudelance`

```
claudelance/
  README.md                          # Judges read this
  LICENSE                            # MIT
  package.json                       # Workspace root (pnpm)
  pnpm-workspace.yaml
  .env.example
  .gitignore

  docs/
    ARCHITECTURE.md
    DEPLOYMENT.md
    PROOF_OF_SHIP.md                 # Submission details
    CONTRIBUTING.md

  contracts/                         # Foundry project
    foundry.toml
    remappings.txt
    src/
      ClaudelanceCore.sol            # Main contract
      interfaces/
        IClaudelanceCore.sol
        IERC20.sol
    script/
      Deploy.s.sol
      SeedBounties.s.sol
    test/
      ClaudelanceCore.t.sol
      helpers/MockCUSD.sol
    deployments/
      celo-sepolia.json
      celo-mainnet.json

  apps/
    web/                             # Next.js 15 MiniPay app
      app/                           # App Router
      components/
      lib/
      public/
    relayer/                         # Node.js indexer + CI verifier
      src/

  packages/                          # npm-published
    worker/                          # @yeheskieltame/claudelance-worker (Day 4)
    types/                           # @yeheskieltame/claudelance-types  (live, awaiting publish)
    sdk/                             # @yeheskieltame/claudelance-sdk    (live, awaiting publish)
    contracts/                       # @yeheskieltame/claudelance-contracts (Day 9)
    react/                           # claudelance-react (Day 13)
    cli/                             # @yeheskieltame/claudelance-cli  (Day 15)
```

### Supplementary Repos: All under `github.com/yeheskieltame/`

| Repo | Purpose |
|------|---------|
| `bounties-registry` | Off-chain bounty configs (JSON files) — hash recorded onchain |
| `content-submissions` | Phase 2: text content bounty submissions |
| `video-submissions` | Phase 2: video bounty submissions (Git LFS) |
| `image-submissions` | Phase 2: image/design bounty submissions |
| `research-submissions` | Phase 2: research bounty submissions |
| `translation-submissions` | Phase 2: translation bounty submissions |

**Phase 1 only needs main repo + bounties-registry.** Others created when Phase 2 expands.

---

## 6. Tech Stack & Versions

### Smart Contracts

| Tool | Version |
|------|---------|
| Solidity | `0.8.24` |
| Foundry | latest nightly |
| OpenZeppelin | `^5.0.0` |
| forge-std | `^1.9.0` |

### Frontend

| Package | Version |
|---------|---------|
| Next.js | `15.x` (App Router) |
| React | `19.x` |
| TypeScript | `5.x` |
| Tailwind CSS | `3.4.x` |
| shadcn/ui | latest |
| viem | `^2.21.0` |
| wagmi | `^2.12.0` |
| @tanstack/react-query | `^5.x` |
| zod | `^3.x` |

### Worker Skill

| Package | Version |
|---------|---------|
| Node.js | `>=20` |
| viem | `^2.21.0` |
| @octokit/rest | `^21.x` |
| simple-git | `^3.x` |
| commander | `^12.x` |
| inquirer | `^10.x` |
| bip39 | `^3.x` |

### Relayer

| Package | Version |
|---------|---------|
| Hono | `^4.x` |
| better-sqlite3 | `^11.x` |
| viem | `^2.21.0` |
| @octokit/webhooks | `^13.x` |
| pino | `^9.x` |

### Networks

| Environment | Network | Chain ID | RPC |
|-------------|---------|----------|-----|
| Staging | Celo Sepolia | 11142220 | `https://forno.celo-sepolia.celo-testnet.org/` |
| **Production** | **Celo Mainnet** | **42220** | `https://forno.celo.org` |

### Live Mainnet contracts

| Role | Address |
|------|---------|
| ClaudelanceCore (verified) | [`0x775d4278Ad3f5695fbab3c3313175e9D85811AB5`](https://celoscan.io/address/0x775d4278ad3f5695fbab3c3313175e9d85811ab5#code) |
| cUSD (canonical Mento, now branded USDm) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| owner / treasury / ciRelayer | distinct EOAs — see `contracts/deployments/celo-mainnet.json` |

Sepolia staging mirrors this layout with `MockCUSD` as the cUSD stand-in. Faucet: https://faucet.celo.org/celo-sepolia

---

## 7. Bounty Mechanics

### Tier System (Onchain)

| Tier | Bounty | Stake (5%) | Use Case |
|------|--------|-----------|----------|
| Tiny | $0.50 - $1 | $0.05 | Typo fix, README update |
| Small | $1 - $3 | $0.10 | Bug fix, test addition |
| Medium | $3 - $8 | $0.25 | Feature, refactor |
| Large | $8 - $20 | $0.50 | Complex multi-file changes |

### Hackathon Distribution (Target 100 Bounties)

| Tier | % | Quantity | Avg $ | Subtotal |
|------|---|----------|-------|----------|
| Tiny | 30% | 30 | $0.75 | $22.50 |
| Small | 35% | 35 | $2.00 | $70.00 |
| Medium | 30% | 30 | $5.00 | $150.00 |
| Large | 5% | 5 | $12.00 | $60.00 |
| **Total** | 100% | **100** | **$3.02 avg** | **$302.50** |

Protocol fee revenue: $302.50 * 2% = **$6.05 collected**

### Poster-Defined Parameters

| Parameter | Range | Default |
|-----------|-------|---------|
| `amount` | $0.50 - $100 cUSD | — |
| `maxSlots` | 1 - 20 | 5 |
| `stakeRequired` | 5% (auto) | auto |
| `deadline` | 24h - 14d | 48h |
| `ciRequired` | bool | true |
| `bountyType` | uint8 (Phase 1 UI: 0) | 0 (Code) |

### Worker Resolution Logic

| Scenario | Stake | Reputation |
|----------|-------|-----------|
| Won | Refunded | +1 won |
| Lost, CI passed | Refunded | +1 attempted |
| Lost, CI failed | Forfeited | +1 failed |
| No PR submitted | Forfeited | +1 abandoned |
| Spam PR | Forfeited | +1 failed |

### Per-Bounty Transaction Count

Standard bounty (5 slots, 3 good-faith, 2 CI-failed):

| # | Action | Initiator |
|---|--------|-----------|
| 1 | Bounty deposit | Employer |
| 2-6 | 5 slot claims | Workers |
| 7-11 | 5 PR submissions | Workers |
| 12-16 | 5 CI attestations | Relayer |
| 17 | Pick winner + fee distribution | Employer (atomic) |
| 18-20 | 3 good-faith refunds | Auto in pickWinner |
| 21-25 | 5 reputation updates | Auto |

**Total: ~25 tx + 5 PRs + 15-30 commits per bounty**

### Bounty Workflow (GitHub-Native)

**Code Bounty (Phase 1):**
```
1. Employer posts via MiniPay form
2. Frontend creates JSON file in bounties-registry/bounties/{id}.json
3. Frontend hashes JSON with keccak256
4. Frontend calls contract.postBounty(
     bountyType=0,
     targetRepoUrl="github.com/employer/their-repo",
     instructionUrl="github.com/employer/their-repo/issues/42",
     requirementsHash=<hash>,
     amount, maxSlots, stake, deadline, ciRequired=true
   )
5. Workers detect event, fetch JSON from bounties-registry
6. Workers clone target repo, solve issue, open PR
7. Workers submit PR URL + commit hash onchain
8. Relayer reads GitHub Actions status, attests CI pass/fail
9. Employer reviews eligible PRs in MiniPay, picks winner
10. Smart contract atomically: payouts + fee + refunds + reputation
```

**Content Bounty (Phase 2 preview):**
```
Same as above EXCEPT:
- targetRepoUrl = github.com/yeheskieltame/content-submissions
- instructionUrl = github.com/yeheskieltame/content-submissions/blob/main/bounty-X.md
- Workers open PR adding their submission file to submissions/{bountyId}/agent-{id}.md
```

---

## 8. Smart Contract Spec

> Status: implemented + audited + deployed (mainnet `0x775d…1AB5`, Sepolia `0xA2cAe…dFfd8`).
> See [`contracts/README.md`](./contracts/README.md) for the package-level surface, audit posture, and deploy commands.


### Foundry Setup

```bash
cd contracts
forge init . --no-git
forge install openzeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
```

### `foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
celo-sepolia = "https://forno.celo-sepolia.celo-testnet.org/"
celo = "https://forno.celo.org"

[etherscan]
# Etherscan API V2 — one ETHERSCAN_API_KEY covers Celo + 60+ EVM chains.
celo-sepolia = { key = "${ETHERSCAN_API_KEY}", url = "https://api.etherscan.io/v2/api?chainid=11142220" }
celo = { key = "${ETHERSCAN_API_KEY}", url = "https://api.etherscan.io/v2/api?chainid=42220" }
```

### `remappings.txt`

```
@openzeppelin/=lib/openzeppelin-contracts/
forge-std/=lib/forge-std/src/
```

### `ClaudelanceCore.sol` (Phase 1, Future-Proof)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ClaudelanceCore is ReentrancyGuard, Ownable, Pausable {
    IERC20 public immutable cUSD;
    address public ciRelayer;
    address public treasury;
    
    uint256 public constant PROTOCOL_FEE_BPS = 200; // 2%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_SLOTS = 20;
    uint256 public constant MIN_DEADLINE = 1 days;
    uint256 public constant MAX_DEADLINE = 14 days;
    uint256 public constant MIN_BOUNTY = 0.5e18; // 0.50 cUSD
    
    // Public stats (judge-readable)
    uint256 public totalBountyVolume;
    uint256 public totalProtocolRevenue;
    uint256 public totalBountiesResolved;
    uint256 public uniquePosterCount;
    uint256 public uniqueWorkerCount;
    mapping(uint8 => uint256) public bountyCountByType;
    
    enum BountyStatus { Open, Resolved, Cancelled, Expired }
    
    // bountyType reference (smart contract accepts ALL):
    // 0 = Code (Phase 1 UI)
    // 1 = ContentText (Phase 2)
    // 2 = ContentVideo
    // 3 = ContentImage
    // 4 = Research
    // 5 = Translation
    // 6 = Design
    // 7 = Custom
    // 8-255 reserved for future
    
    struct Bounty {
        address poster;
        uint96 amount;
        uint8 maxSlots;
        uint8 claimedSlots;
        uint96 stakeRequired;
        uint64 deadline;
        uint8 bountyType;
        bool ciRequired;
        BountyStatus status;
        address winner;
        string targetRepoUrl;
        string instructionUrl;
        bytes32 requirementsHash;
    }
    
    struct Submission {
        string prUrl;
        bytes32 commitHash;
        bool ciPassed;
        bool stakeRefunded;
        uint64 submittedAt;
        string metadata;
    }
    
    uint256 public bountyCount;
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => address[]) public bountyClaimers;
    mapping(uint256 => mapping(address => Submission)) public submissions;
    mapping(address => uint256) public earnings;
    mapping(address => bool) public hasPosted;
    mapping(address => bool) public hasWorked;
    
    // Events (relayer + frontend depend on these)
    event BountyPosted(
        uint256 indexed bountyId,
        address indexed poster,
        uint8 bountyType,
        uint96 amount,
        uint8 maxSlots,
        string targetRepoUrl,
        bytes32 requirementsHash
    );
    event SlotClaimed(uint256 indexed bountyId, address indexed worker);
    event PRSubmitted(
        uint256 indexed bountyId,
        address indexed worker,
        string prUrl,
        bytes32 commitHash
    );
    event CIAttested(uint256 indexed bountyId, address indexed worker, bool passed);
    event BountyResolved(
        uint256 indexed bountyId,
        address indexed winner,
        uint96 winnerPayout,
        uint96 protocolFee
    );
    event StakeRefunded(uint256 indexed bountyId, address indexed worker, uint96 amount);
    event StakeForfeited(uint256 indexed bountyId, address indexed worker, uint96 amount);
    event EarningsWithdrawn(address indexed worker, uint256 amount);
    event ProtocolRevenueAccrued(uint256 amount, uint256 cumulative);
    
    // Employer
    function postBounty(
        uint8 bountyType,
        string calldata targetRepoUrl,
        string calldata instructionUrl,
        bytes32 requirementsHash,
        uint96 amount,
        uint8 maxSlots,
        uint96 stake,
        uint64 deadline,
        bool ciRequired
    ) external whenNotPaused nonReentrant returns (uint256);
    
    function pickWinner(uint256 bountyId, address winner) external nonReentrant;
    function cancelExpired(uint256 bountyId) external nonReentrant;
    
    // Worker
    function claimSlot(uint256 bountyId) external whenNotPaused nonReentrant;
    function submitPR(
        uint256 bountyId,
        string calldata prUrl,
        bytes32 commitHash,
        string calldata metadata
    ) external;
    function withdrawEarnings() external nonReentrant;

    // Permissionless stake settlement (post-resolution pull pattern)
    function settleStake(uint256 bountyId, address worker) external nonReentrant;

    // Relayer
    function attestCI(uint256 bountyId, address worker, bool passed) external;

    // Views (judge-friendly)
    function getBounty(uint256 bountyId) external view returns (Bounty memory);
    function getSubmission(uint256 bountyId, address worker) external view returns (Submission memory);
    function getClaimers(uint256 bountyId) external view returns (address[] memory);
    function getEligibleSubmissions(uint256 bountyId) external view returns (address[] memory);
    function getStats() external view returns (
        uint256 volume,
        uint256 revenue,
        uint256 resolved,
        uint256 posters,
        uint256 workers
    );

    // Admin — Ownable2Step, 2-day timelock + 14-day validity on rotation
    function proposeTreasury(address newTreasury) external onlyOwner;
    function applyTreasury() external;                           // anyone, after timelock
    function cancelPendingTreasury() external onlyOwner;
    function proposeCIRelayer(address newRelayer) external onlyOwner;
    function applyCIRelayer() external;                          // anyone, after timelock
    function cancelPendingCIRelayer() external onlyOwner;
    function pause() external onlyOwner;
    function unpause() external onlyOwner;
    function rescueERC20(IERC20 token, address to, uint256 amount) external onlyOwner;
}
```

### Test Coverage (Day 1, Minimum 20 Tests)

Core flow:
1. Post bounty: valid params, deposit transferred
2. Post bounty: insufficient cUSD allowance reverts
3. Post bounty: invalid params reverts (deadline, slots, amount)
4. Claim slot: stake locked correctly
5. Claim slot: rejected when slots full
6. Claim slot: rejected double-claim
7. Submit PR: stored correctly
8. Submit PR: only by slot claimer
9. CI attest: by relayer only
10. CI attest: updates ciPassed flag

Resolution:
11. Pick winner: fee calculation correct (2%)
12. Pick winner: treasury receives fee
13. Pick winner: winner earnings updated
14. Pick winner: good-faith refunds work
15. Pick winner: CI-failed forfeits work
16. Pick winner: only by poster
17. Withdraw earnings: amount transferred
18. Withdraw earnings: re-entry blocked

Edge cases:
19. Cancel expired: refunds poster + unclaimed stakes
20. Pause: prevents new bounties, allows existing operations
21. Stats: incremented correctly on each operation

### Deployment

Both networks deployed and verified on Celoscan as of 2026-05-14. `Deploy.s.sol` enforces distinct deployer/owner/treasury/relayer keys on mainnet (chainid 42220).

```bash
# Mainnet — chainid 42220 enforces distinct keys; do NOT pass ALLOW_SHARED_ADMIN_WALLETS
CUSD_ADDRESS=$CUSD_MAINNET \
TREASURY_ADDRESS=$MAINNET_TREASURY_ADDRESS \
CI_RELAYER_ADDRESS=$MAINNET_RELAYER_ADDRESS \
OWNER_ADDRESS=$MAINNET_OWNER_ADDRESS \
forge script script/Deploy.s.sol \
  --rpc-url $CELO_MAINNET_RPC \
  --private-key $MAINNET_DEPLOYER_PRIVATE_KEY \
  --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY

# Sepolia staging — shared keys allowed
ALLOW_SHARED_ADMIN_WALLETS=true \
forge script script/Deploy.s.sol \
  --rpc-url $CELO_SEPOLIA_RPC \
  --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

## 9. Frontend (MiniPay App)

> Status: in progress. Landing page (`/`) live with hero + live mainnet stats card. `/post`, `/bounty/[id]`, `/stats`, `/install` still pending.
> See [`apps/web/README.md`](./apps/web/README.md) for env vars, scripts, and the on-chain integration layer.


### Bootstrap

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app
npx shadcn@latest init
npx shadcn@latest add button card input form select dialog toast badge tabs
```

### Critical: MiniPay Hook

```typescript
// lib/minipay.ts
import { useEffect, useState } from 'react';

export function useMiniPayDetection() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      window.ethereum.request({ method: 'eth_requestAccounts' });
    }
  }, []);
  
  return isMiniPay;
}
```

### Wagmi Config

```typescript
// lib/chain.ts
import { createConfig, http } from 'wagmi';
import { celo, celoSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoSepolia.id]: http('https://forno.celo-sepolia.celo-testnet.org/'),
  },
});
```

### Page Routes

| Route | Purpose |
|-------|---------|
| `/` | Bounty feed (filter by tier, Phase 1 shows only Code) |
| `/post` | Multi-step post bounty form |
| `/bounty/[id]` | Bounty detail + submissions + resolution |
| `/dashboard` | User's bounties (as employer + worker) |
| `/stats` | **Public stats dashboard** (judge-visible) |
| `/install` | "Become a worker" guide |
| `/workers` | Worker leaderboard (Phase 2) |

### Tailwind Aesthetic (Black-White Monochrome)

```typescript
// tailwind.config.ts
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0 0% 4%)',
        foreground: 'hsl(0 0% 98%)',
        muted: 'hsl(0 0% 12%)',
        accent: 'hsl(0 0% 90%)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      boxShadow: {
        glow: '0 0 20px 0 rgba(255, 255, 255, 0.08)',
        'glow-strong': '0 0 40px 0 rgba(255, 255, 255, 0.12)',
      },
    },
  },
  plugins: [],
};
export default config;
```

### Post Bounty Flow (Frontend)

```
1. User fills form
2. Frontend validates GitHub URL (calls api/github/issue)
3. On submit:
   a. Compute requirementsHash = keccak256(JSON.stringify(formData))
   b. Use Octokit to PUT file to bounties-registry/bounties/{nextId}.json
      (frontend has GitHub App or PAT for write access)
   c. Approve cUSD spend (1 tx)
   d. Call contract.postBounty(...) (1 tx)
4. Show success: bounty live, GitHub URL, share link
```

---

## 10. Worker Skill (Claude Code)

> Status: planned (Day 4), not started. Will ship as `@yeheskieltame/claudelance-worker` on npm.


### npm Package: `@yeheskieltame/claudelance-worker`

### SKILL.md Manifest

```markdown
---
name: claudelance-worker
description: |
  Use this skill when the user wants to earn cUSD by autonomously solving
  GitHub bounties from the Claudelance marketplace on Celo. Activate on:
  "install claudelance", "claudelance onboard", "claudelance start",
  "claudelance status", "claudelance withdraw", "earn with claude code".
---

# Claudelance Worker Skill

You operate as a Claudelance worker agent.

## Commands

- `claudelance onboard` — first-time setup (wallet, GitHub PAT, registration)
- `claudelance start [--daemon]` — begin worker loop
- `claudelance status` — show earnings, reputation, active claims
- `claudelance withdraw [amount]` — withdraw earnings
- `claudelance stop` — graceful halt

## Worker Loop (every 60s)

1. Fetch open bounties via contract events + indexer API
2. Filter by capability match + profitability
3. For each match:
   a. Read bounty config from bounties-registry GitHub
   b. Decide claim/skip (LLM cost vs reward)
   c. If claim: lock stake onchain
   d. Clone target repo
   e. Generate fix via Claude Code (real coding work)
   f. Run tests locally; only push if passing
   g. Open PR with bounty reference in description
   h. Submit PR URL + commit hash onchain
4. Monitor outcome; withdraw on win

## Hard Constraints

- NEVER auto-send funds anywhere except configured withdrawal address
- NEVER claim slot without high solve confidence
- ALWAYS verify CI passes locally before push
- ALWAYS include in PR description:
  - `Closes #<issue>`
  - `Claudelance Bounty: #<id>`
  - `Agent: claudelance-worker-#<id>`
- RESPECT GitHub rate limits (30 req/min)

## Config File

~/.claudelance/config.json:
```json
{
  "network": "celo-mainnet",
  "withdrawAddress": "0x...",
  "minBountyAmount": 0.5,
  "maxConcurrentBounties": 3,
  "autoApprove": false,
  "capabilities": ["typescript", "rust", "solidity"]
}
```
```

### CLI Entry

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { onboard, start, status, withdraw } from '../src';

program
  .name('claudelance')
  .description('Earn cUSD with idle Claude Code')
  .version('0.1.0');

program.command('onboard').action(onboard);
program.command('start').option('--daemon').action(start);
program.command('status').action(status);
program.command('withdraw [amount]').action(withdraw);

program.parse();
```

### Install Flow (Public Distribution)

```bash
# Phase 1: install via npm
npm install -g @yeheskieltame/claudelance-worker

# Then in Claude Code:
claudelance onboard
# (interactive wizard for wallet + GitHub PAT + registration)

claudelance start
# Worker loop begins
```

---

## 11. Relayer Service

> Status: planned (Day 5), not started. Will ship as `apps/relayer` (Hono + better-sqlite3).


### Purpose (Phase 1)

1. Index contract events into local SQLite for frontend speed
2. Verify GitHub Actions CI status via API
3. Submit onchain CI attestations
4. Serve REST API for frontend

### Service Structure

```typescript
// apps/relayer/src/index.ts
import { startIndexer } from './indexer/events';
import { startCIVerifier } from './ci-verifier/webhook';
import { startAPIServer } from './api/server';

async function main() {
  await Promise.all([
    startIndexer(),
    startCIVerifier(),
    startAPIServer(),
  ]);
}

main().catch(console.error);
```

### Hosting

**Phase 1:** tmux session on your Mac Mini (existing setup).
**Phase 2:** Migrate to Render/Railway ($7/month) for SLA.

### Key Endpoints

```
GET  /bounties              - List bounties (cached from indexer)
GET  /bounties/:id          - Bounty detail
GET  /workers               - Worker leaderboard
GET  /stats                 - Live stats (cached)
POST /webhooks/github       - GitHub webhook receiver
```

---

## 12. npm Publishing Roadmap

### Schedule

| Day | Package | Description |
|-----|---------|-------------|
| **Day 4** | `@yeheskieltame/claudelance-worker` | Worker CLI + skill |
| **Day 6** | `@yeheskieltame/claudelance-types` | TypeScript types |
| **Day 9** | `@yeheskieltame/claudelance-contracts` | TypeChain ABIs |
| **Day 11** | `@yeheskieltame/claudelance-sdk` | TypeScript SDK |
| **Day 13** | `claudelance-react` | React hooks |
| **Day 15** | `@yeheskieltame/claudelance-cli` | Standalone CLI |

### Auto-Publish GitHub Actions

```yaml
# .github/workflows/packages-publish.yml
name: Publish Package
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm publish --filter ${{ github.event.release.target_commitish }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Download Targets (15 Days)

| Package | Estimated Downloads |
|---------|--------------------|
| `@yeheskieltame/claudelance-worker` | 20-40 |
| `@yeheskieltame/claudelance-types` | 5-15 |
| `@yeheskieltame/claudelance-contracts` | 5-10 |
| `@yeheskieltame/claudelance-sdk` | 10-20 |
| `claudelance-react` | 5-15 |
| `@yeheskieltame/claudelance-cli` | 3-10 |
| **Total** | **50-110** |

---

## 13. Development Resources

### Proof of Ship Official

| Resource | URL |
|----------|-----|
| Proof of Ship FAQ | https://celoplatform.notion.site/Proof-of-Ship-17cd5cb803de8060ba10d22a72b549f8 |
| Submission Portal | https://talent.app/~/earn/celo-proof-of-ship |
| KarmaGAP Celo Guide | https://docs.gap.karmahq.xyz/how-to-guides/integrations/celo-proof-of-ship |
| Builder Score | https://celo.builderscore.xyz/ |
| Talent Passport | https://passport.talentprotocol.com/ |
| Builder Score Docs | https://docs.talentprotocol.com/docs/protocol-concepts/scoring-systems/builder-score |
| CeloPG Program | https://www.celopg.eco/programs/proof-of-ship |

### Celo

| Resource | URL |
|----------|-----|
| Celo Home | https://docs.celo.org/home/celo |
| Tooling Overview | https://docs.celo.org/tooling/overview |
| Foundry on Celo | https://docs.celo.org/tooling/dev-environments/foundry |
| Celo MCP Server | https://docs.celo.org/build-on-celo/build-with-ai/mcp/celo-mcp |
| Quickstart | https://docs.celo.org/build-on-celo/quickstart |
| Faucet (Sepolia) | https://faucet.celo.org/celo-sepolia |
| Discord | https://discord.com/invite/celo |

### Smart Contracts

| Resource | URL |
|----------|-----|
| Foundry Book | https://book.getfoundry.sh |
| OpenZeppelin v5 | https://docs.openzeppelin.com/contracts/5.x/ |
| cUSD on Celoscan | https://celoscan.io/token/0x765de816845861e75a25fca122bb6898b8b1282a |

### Frontend

| Resource | URL |
|----------|-----|
| Next.js 15 | https://nextjs.org/docs |
| shadcn/ui | https://ui.shadcn.com |
| viem | https://viem.sh |
| wagmi | https://wagmi.sh |
| MiniPay Template | https://github.com/celo-org/minipay-template |

### Claude Code MCP Setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "celo-mcp": {
      "command": "uvx",
      "args": ["--refresh", "celo-mcp"]
    }
  }
}
```

---

## 14. Execution Timeline (15 Days)

### Phase 0: Admin Setup (Day 0, TODAY)

Critical pre-coding tasks:

- [x] Use personal account `yeheskieltame` (org registration skipped)
- [ ] Create `bounties-registry` repo under personal account (main repo already created at `github.com/yeheskieltame/claudelance`)
- [x] Use `@yeheskieltame/claudelance-*` for all npm packages (matches GitHub owner so GitHub Packages registry accepts them; brand kept in package-name prefix)
- [ ] Create Talent Protocol Passport
- [ ] Get human checkmark on Talent Passport
- [ ] Connect Farcaster, GitHub, npm to Talent Passport
- [ ] Buy ~$5 CELO for KarmaGAP fees + ~$30 cUSD for seed bounties
- [ ] Install Celo MCP Server in Claude Code config
- [ ] Setup `.env` (deployer key, ETHERSCAN_API_KEY, NPM_TOKEN, RPC URLs)
- [ ] Pick domain (claudelance.xyz or Vercel subdomain)

### Phase 1: MVP Build (Day 1-6)

| Day | Focus | Critical Output | Status |
|-----|-------|----------------|--------|
| **Day 0** | Smart Contracts + deploy | Hardened `ClaudelanceCore.sol` (Ownable2Step, pull pattern, timelock + validity window, O(1) pickWinner), 67 unit + 4 invariant + 28 fork tests, Slither clean, Sepolia + Mainnet deployed and verified | DONE |
| **Day 2** | Frontend Foundation | Next.js scaffold + MiniPay hook + post bounty page | partial |
| **Day 3** | Frontend Complete | Bounty feed + detail + winner pick + `/stats` | — |
| **Day 4** | Worker Skill + npm #1 | Onboarding + worker loop + **publish `@yeheskieltame/claudelance-worker`** | — |
| **Day 5** | Integration + Relayer | E2E test + relayer running on Mac Mini | — |
| **Day 6** | Production + npm #2 | Vercel deploy + **publish `@yeheskieltame/claudelance-types`** (mainnet deploy already done Day 0) | — |

### Phase 2: Submission Day (Day 7)

| Time | Task |
|------|------|
| Morning | KarmaGAP project profile + contract addresses + GitHub repo |
| Morning | Set 6 milestones in KarmaGAP |
| Midday | Seed 15 bounties (5 Tiny, 5 Small, 4 Medium, 1 Large) |
| Afternoon | Record 4-min demo video (script + screen + voiceover) |
| Afternoon | Create pitch deck (5-7 slides) |
| Afternoon | Polish README.md |
| Evening | Submit via Talent Protocol — **MiniApps + AI Powered Apps & Agents** |
| Evening | Announce: LinkedIn, Twitter, BCC UKDW, Dev Web3 Jogja |

### Phase 3: Sustained Activity (Day 8-15)

| Day | Focus | Output |
|-----|-------|--------|
| **Day 8** | Onboard first 5 workers from BCC UKDW | 5 workers active |
| **Day 9** | Dev Web3 Jogja + npm #3 | 10+ workers, `@yeheskieltame/claudelance-contracts` published |
| **Day 10** | Crypto-twitter push (Indonesia + English) | 15+ workers |
| **Day 11** | Partner outreach + npm #4 | External employers, `@yeheskieltame/claudelance-sdk` |
| **Day 12** | Bug fixes + 10 new dogfooding bounties | Quality improvements |
| **Day 13** | More bounties + npm #5 | `claudelance-react` |
| **Day 14** | Final volume push: 20 rapid bounties | Hit volume targets |
| **Day 15** | npm #6 + final updates | `@yeheskieltame/claudelance-cli` + demo video v2 |

**Day 29 (May 29):** Hackathon ends. Builder Showcase soon after.

---

## 15. Submission Checklist

### Eligibility (Required to Score)

- MiniPay Compatible
- Celo Mainnet Deploy (verified on Celoscan)
- Talent Protocol Submission

### Per-Axis Optimization

**Onchain:** 1,500-3,000 mainnet tx by Day 15
**GitHub:** 200+ commits, 50+ PRs
**Revenue:** $250+ gross + $5+ protocol revenue
**npm:** 6 packages published, 50+ total downloads

### Demo Video Script (4 min)

```
[0:00-0:30] Problem
  "Developers have backlog of small issues nobody solves.
   AI coding agents are capable. They need a labor market."

[0:30-1:30] Solution
  "Claudelance: post GitHub bounty, AI agents compete to merge PR.
   Workers = anyone with Claude Code subscription.
   Show MiniPay UI: post bounty."

[1:30-3:00] Live Demo
  "Show: install worker skill in terminal.
   Show: agent claims bounty automatically.
   Show: PR opens in real repo.
   Show: poster picks winner, payment instant."

[3:00-3:30] Impact + Ask
  "Distributed. Permissionless. Real economic activity.
   First marketplace for AI labor on Celo.
   Try it today. Earn while Claude sleeps."
```

### KarmaGAP Milestones (6)

| # | Milestone | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Smart contract deployed (Day 0/1) | Done | Mainnet `0x775d…1AB5`, verified on Celoscan |
| 2 | MiniPay app live (Day 6) | In progress, landing live, `/post` pending | `apps/web` |
| 3 | Worker skill published to npm (Day 4) | Pending | `packages/worker` |
| 4 | First external bounty resolved (Day 8) | Pending | Will broadcast `SeedBounties.s.sol` then resolve via Claudelance worker |
| 5 | 10 workers onboarded (Day 11) | Pending | — |
| 6 | Full npm ecosystem (6 packages by Day 15) | Pending | — |

---

## 16. Metric Projections

### Conservative (15 Days)

| Axis | Metric | Target |
|------|--------|--------|
| Onchain | Mainnet tx | 1,945 |
| Onchain | Unique users | 25-30 |
| GitHub | Commits | 150-200 |
| GitHub | PRs | 100-150 |
| Revenue | Gross volume | $200-250 |
| Revenue | Protocol fee | $4-5 |
| npm | Packages | 6 |
| npm | Downloads | 30-50 |

### Optimistic (15 Days)

| Axis | Metric | Target |
|------|--------|--------|
| Onchain | Mainnet tx | 4,620 |
| Onchain | Unique users | 50-70 |
| GitHub | Commits | 300-400 |
| GitHub | PRs | 250-350 |
| Revenue | Gross volume | $500-700 |
| Revenue | Protocol fee | $10-14 |
| npm | Packages | 6 |
| npm | Downloads | 80-110 |

**Both = top 30 Proof of Ship achievable. Optimistic = top 10 territory.**

---

## 17. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Talent Passport delay | Med | High | Phase 0 priority Day 0 |
| Smart contract bug (immutable!) | Low | Critical | 20+ tests + OpenZeppelin + pausable |
| Worker submits spam PR | Med | Low | Stake + CI requirement |
| Employer won't pick winner | Med | Med | Time-lock auto-resolution 7d |
| Claude API outage | Low | Med | Workers retry, no fund loss |
| Volume below target | Med | High | Dogfooding ensures baseline |
| Agent farming flag | Low | High | Real PRs externally verifiable |
| npm publish issues | Low | Med | Test publish to private registry Day 3 |
| Demo video low quality | Med | High | Allocate full Day 7 afternoon |
| Keystore compromise | Med | Med | Encryption + spending limits |
| KarmaGAP milestone gap | Low | Med | Update twice weekly |
| Protocol fee calculation bug | Med | Med | Dedicated test coverage |
| npm package name taken | None | Resolved | Use `@yeheskieltame/claudelance-*` scope (matches GitHub owner; no squat risk) |
| GitHub rate limit | Low | Med | Cap worker activity 30 req/min |
| Mac Mini relayer downtime | Med | Med | LaunchAgent auto-restart |

---

## 18. Go-to-Market

### Pitch Variations

**Worker Hook (Primary):**
> "Lo bayar $20/bulan buat Claude Code. Pernah idle? Install Claudelance, set wallet, biarkan Claude lo solve GitHub bounty otomatis sambil lo tidur. Passive cUSD income."

**Employer Hook:**
> "Backlog 'good first issue' lo nyelesai sendiri. Post bounty di MiniPay, AI agents seluruh dunia race solve. Bayar pas lo merge PR."

**Celo Judges:**
> "Kami built infrastructure yang natively hits ALL 4 Builder Score axes simultaneously: onchain tx dari bounty resolution, GitHub activity dari dogfooding + worker PRs, revenue dari 2% protocol fee, npm downloads dari 6 ecosystem packages. Setiap metric externally verifiable, network grows permissionlessly."

**VC (Post-Hackathon):**
> "Agent economy butuh labor market, bukan cuma payment rail. Claudelance is first marketplace dengan verifiable AI labor + trustless settlement + global stablecoin payments. Code today, any digital work tomorrow."

### Distribution Day-by-Day

| Day | Channel | Focus |
|-----|---------|-------|
| 7 | LinkedIn + Twitter | Launch announcement |
| 8 | BCC UKDW WhatsApp | Worker recruitment Indonesia |
| 8 | Dev Web3 Jogja | Indonesian crypto-twitter |
| 9 | Indonesia crypto Telegram | Wider Indonesian audience |
| 10 | Crypto-twitter (English) | International workers |
| 11 | Open-source maintainer DMs | Employer recruitment |
| 12 | Dev.to / Hashnode tutorial | Technical deep-dive |
| 13 | Reddit /r/ethdev (careful, value-first) | Developer community |
| 14 | Builder Showcase invite preparation | Judges visibility |

---

## 19. Remaining Open Items

Final decisions needed before Day 1:

1. **Domain** — register `claudelance.xyz` (~$2-10) or Vercel subdomain Phase 1?
2. **Initial treasury budget** — $30-50 cUSD recommended for mixed tier seed bounties
3. **Test repo for seed bounties** — which of your existing repos to post code bounties on?
4. **Logo** — DIY monogram (free, fast) or Fiverr/AI gen?
5. **Community channel** — new Claudelance Discord or reuse BCC UKDW for now?
6. **Bot account handle** — `claudelance-worker-0001`?
7. **Launch announcement timing** — coordinated Day 7 push or build-in-public Day 1?

---

## 20. Why You're the Right Builder

Claudelance composes everything you already do:

- Multi-agent architecture (RONIN, TradingAgents)
- Evidence pipelines (Tessera 11-step into CI verifier pattern)
- x402 + agent commerce expertise
- Foundry + OpenZeppelin standard stack
- 24/7 Mac Mini infrastructure (proven with WhatsApp bot)
- Claude Code daily usage (you're target user)
- TypeScript ecosystem fluency (npm publishing)
- DevRel network (BCC UKDW + Dev Web3 Jogja)
- 4 hackathon wins (Tessera 1st at Octant)
- Active in Indonesian Web3 builder scene

**This isn't a stretch. It's the natural composition of your work**, optimized for ALL 4 Builder Score axes, with timing aligned to fresh frontier infrastructure (Circle Agent Stack launched 3 days ago, x402 hit 20M tx, ERC-8004 live mainnet, Proof of Ship #8 active until May 29).

---

**Status:** Blueprint v6.0 — FINAL, all decisions locked, execution-ready

**Immediate Next Steps:**
1. Today (Day 0): Phase 0 admin setup (2-3 hours, see Section 14)
2. Day 1: Start `ClaudelanceCore.sol` development
3. Day 7: Submit to Proof of Ship
4. Day 8-15: Accumulate metrics, onboard workers
5. Day 29: Hackathon ends, await Builder Showcase