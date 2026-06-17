# ClaudelanceCore v3 - Contract Architecture

## Status

**v2** - immutable at `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423` (Celo Mainnet). Serves existing code bounties.

**v3 - LIVE (2026-06-04)**

| Network | Proxy | Implementation |
|---------|-------|----------------|
| Celo Mainnet (42220) | `0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8` | `0x92b7d04E9A3fa3C96bfc891D8E8dB61Fe6C1D49C` |
| Celo Sepolia (11142220) | `0x64b45Fe2C64951013389740AD530e5c664fd0Ffe` | `0x1fb667a40159e4652A89dDFC9ADF3eEcB6F0A572` |

Both Celoscan-verified. cUSD / CELO / USDC whitelisted on both networks. 144 tests pass (23 unit + 38 fork against live Sepolia + 79 v2 regression).

---

## Why UUPS for v3

v2's immutability was correct for Phase 1 - minimal surface area, no admin risk.
v3 introduces 10+ task type categories, a deliverable registry, disclaimer enforcement,
and a pluggable verification layer. These subsystems will evolve as the marketplace
grows; an immutable contract would require a full redeploy for each iteration.

UUPS (EIP-1822) is chosen over Transparent Proxy because:
- The upgrade authority is stored in the implementation (not the proxy admin), reducing
  admin key surface area
- The `_authorizeUpgrade` hook can require multisig approval (plugged into the existing
  Safe at `0xe9Fc48f315fD4E989637fAcC29AaF2717E19f7F0`)
- OpenZeppelin Upgradeable contracts (`@openzeppelin/contracts-upgradeable`) are
  battle-tested and Slither-clean

---

## OpenZeppelin Imports (v3)

```solidity
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
```

Foundry install:
```bash
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
```

---

## Contract Hierarchy

```
ClaudelanceProxy (ERC1967Proxy)
  └── ClaudelanceCoreV3 (implementation)
        ├── Initializable
        ├── UUPSUpgradeable
        ├── Ownable2StepUpgradeable
        ├── PausableUpgradeable
        └── ReentrancyGuardUpgradeable
```

The proxy is deployed once. Each upgrade only redeploys the implementation and calls
`upgradeToAndCall(newImpl, "")` through the Safe multisig (OZ v5 removed `upgradeTo`;
`upgradeToAndCall` is the only upgrade entrypoint).

---

## Storage Layout (EIP-7201 namespaced storage)

To prevent storage collisions across upgrades, v3 uses EIP-7201 namespaced storage:

```solidity
// @custom:storage-location erc7201:claudelance.core.v3
struct CoreStorage {
    // --- Token whitelist ---
    mapping(address => bool) allowedToken;
    mapping(address => uint256) minBounty;

    // --- Protocol stats ---
    mapping(address => uint256) totalBountyVolume;
    mapping(address => uint256) totalProtocolRevenue;
    uint256 totalBountiesResolved;
    uint256 uniquePosterCount;
    uint256 uniqueWorkerCount;
    mapping(uint8 => uint256) bountyCountByType;

    // --- Bounty state ---
    uint256 bountyCount;
    mapping(uint256 => Bounty) bounties;
    mapping(uint256 => address[]) claimers;
    mapping(uint256 => mapping(address => bool)) hasClaimed;
    mapping(uint256 => mapping(address => Submission)) submissions;

    // --- Earnings ---
    mapping(address => mapping(address => uint256)) earnings;
    mapping(address => bool) hasPosted;
    mapping(address => bool) hasWorked;

    // --- Admin timelocks ---
    PendingAddress pendingTreasury;
    PendingAddress pendingCIRelayer;

    // --- v3 additions ---
    mapping(uint8 => TypeConfig) taskTypeConfigs;
    mapping(uint8 => bool) taskTypeEnabled;
    mapping(string => bool) disclaimerRequiredTypes; // relayer hint
}

bytes32 private constant CORE_STORAGE_SLOT =
    keccak256(abi.encode(uint256(keccak256(bytes("claudelance.core.v3"))) - 1)) & ~bytes32(uint256(0xff));
```

---

## Key Structural Changes from v2

### 1. Deliverable abstraction

`submitPR(bountyId, prUrl, commitHash, metadata)` becomes:

```solidity
function submitDeliverable(
    uint256 bountyId,
    string calldata deliverableUrl,   // GitHub PR, Gist, IPFS, Arweave, any URL
    bytes32 deliverableHash,           // keccak256 of the deliverable content
    string calldata metadata
) external;
```

The `commitHash` (git-specific) is generalized to `deliverableHash` (keccak256 of
any content). For code bounties it remains the git commit SHA padded to 32 bytes.
For non-code types it's the keccak256 of the deliverable document.

### 2. Task type configuration

```solidity
struct TypeConfig {
    bool ciSupported;       // can relayer attest CI for this type
    bool disclaimerRequired; // relayer rejects if disclaimer absent (types 8, 9)
    uint8 minReviewers;     // 0 = poster-only; 1+ = multi-sig quorum (future)
    string deliverableSchema; // IPFS CID of JSON schema for this type's output
}
```

Owner can register new task types without upgrade:
```solidity
function configureTaskType(
    uint8 typeId,
    TypeConfig calldata config
) external onlyOwner;
```

### 3. UUPS upgrade gate

```solidity
function _authorizeUpgrade(address newImplementation)
    internal override onlyOwner {}
```

On mainnet, `owner` is the Safe multisig (threshold 2), so upgrades require 2-of-N
signer approval. Single-key compromise cannot upgrade the contract.

### 4. Initializer (replaces constructor)

```solidity
function initialize(
    address _treasury,
    address _ciRelayer,
    address _owner,
    IERC721 _identityRegistry,
    address _reputationRegistry
) external initializer {
    // OZ v5: Ownable2StepUpgradeable inherits __Ownable_init; pass owner here.
    // There is no parameterless __Ownable2Step_init in OZ v5.
    __Ownable_init(_owner);
    __Pausable_init();
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
    // ... set storage fields
}
```

### 5. Backward-compatible stats

`getStats(token)` is extended to `getStatsV3(token)` which adds:
```solidity
function getStatsV3(address token) external view returns (
    uint256 volume,
    uint256 revenue,
    uint256 resolved,
    uint256 posters,
    uint256 workers,
    uint256[11] memory countByType  // per-type resolved counts
);
```

---

## Deployment Plan (v3)

### Sepolia staging

```bash
# 1. Deploy implementation
forge script script/DeployV3.s.sol \
  --rpc-url $CELO_SEPOLIA_RPC --broadcast --verify \
  --private-key $DEPLOYER_PRIVATE_KEY

# 2. Deploy ERC1967Proxy pointing to implementation
#    (included in DeployV3.s.sol)

# 3. Initialize
#    (called inside DeployV3.s.sol via proxy)

# 4. allowToken for each mock token
```

### Mainnet

Same flow, but `_owner` = Safe multisig address. `allowToken` calls go through
the Safe UI at `https://app.safe.global`.

`Deploy.s.sol` continues to enforce 4-key separation on chainid 42220.

---

## v2 → v3 Migration

v2 is NOT migrated. It runs in parallel:

| Contract | Purpose | Status |
|----------|---------|--------|
| v2 `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423` | Code bounties (type 0), existing state | Permanent, immutable |
| v3 proxy `0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8` | All types 0–10, upgradeable | **LIVE 2026-06-04** |

Frontend connects to both - `/bounties` feed queries both contracts and merges results.
SDK adds `network: "v3"` option alongside existing `"celo"` / `"sepolia"`.

---

## Security Considerations

1. **Upgrade key is the Safe multisig** - cannot be upgraded by a single compromised key.
2. **Storage namespacing** - EIP-7201 prevents slot collision between v3 versions.
3. **Initializer guard** - `initializer` modifier prevents re-initialization.
4. **`_disableInitializers()`** called in the implementation constructor - prevents
   direct initialization of the implementation contract.
5. **Token whitelist is one-way** - same as v2; cannot strand live escrows.
6. **Pause mechanism** - owner can pause/unpause via Safe.
7. **Reentrancy guards** - all fund-moving functions use `nonReentrant`.
8. **Pull pattern** - earnings and stake refunds are pull-based (no push to untrusted addresses).

---

## Test Plan (v3 additions)

Beyond the 83 unit + 4 invariant tests inherited from v2:

```
test/v3/
  UpgradeProxy.t.sol        - deploy proxy, upgrade impl, storage integrity
  TaskTypes.t.sol           - configureTaskType, enabled/disabled checks
  DeliverableSubmit.t.sol   - submitDeliverable with non-code types
  DisclaimerAttest.t.sol    - relayer rejects submission without disclaimer (types 8,9)
  StorageLayout.t.sol       - slot collision check across two impl versions
  Invariants.v3.t.sol       - extend v2 invariant suite for v3 state
```

Target: 120+ tests before mainnet v3 deploy.

---

## Timeline

| Milestone | Status |
|-----------|--------|
| Sepolia v3 deploy (all 10 types, EIP-7201) | **DONE - 2026-06-04** |
| 144 tests pass (23 unit + 38 fork + 79 regression) | **DONE** |
| Security review cleared (no Critical/High/Medium) | **DONE** |
| Mainnet v3 deploy via deployer key | **DONE - 2026-06-04** |
| allowToken cUSD/CELO/USDC via Safe multisig | **DONE - 2026-06-06** (Safe exec confirmed) |
| Frontend v3 pages (/post-v3, /bounties?v=3) | Pending |
| SDK v3 support (`@yeheskieltame/claudelance-sdk@1.0.0`) | Pending |
