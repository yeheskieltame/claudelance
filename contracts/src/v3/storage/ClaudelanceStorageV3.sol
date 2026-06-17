// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Bounty, Submission, TypeConfig, PendingAddress } from "../types/ClaudelanceTypes.sol";

/// @dev All mutable state lives here, isolated under an EIP-7201 namespace.
///      Never change the order or type of existing fields - only append to CoreStorage.
///      Appending is safe because EIP-7201 gives us an isolated storage region.
struct CoreStorage {
    // ── Token whitelist ─────────────────────────────────────────
    mapping(address => bool) allowedToken;
    mapping(address => uint256) minBounty;

    // ── Protocol stats ───────────────────────────────────────────
    mapping(address => uint256) totalBountyVolume;   // per-token
    mapping(address => uint256) totalProtocolRevenue; // per-token
    uint256 totalBountiesResolved;
    uint256 uniquePosterCount;
    uint256 uniqueWorkerCount;
    mapping(uint8 => uint256) bountyCountByType;

    // ── Bounty state ─────────────────────────────────────────────
    uint256 bountyCount;
    mapping(uint256 => Bounty) bounties;
    mapping(uint256 => address[]) claimers;
    mapping(uint256 => mapping(address => bool)) hasClaimed;
    mapping(uint256 => mapping(address => Submission)) submissions;

    // ── Earnings (pull pattern) ──────────────────────────────────
    mapping(address => mapping(address => uint256)) earnings; // worker → token → amount
    mapping(address => bool) hasPosted;
    mapping(address => bool) hasWorked;

    // ── Admin timelocks ──────────────────────────────────────────
    PendingAddress pendingTreasury;
    PendingAddress pendingCIRelayer;
    address treasury;
    address ciRelayer;

    // ── Immutable-ish refs (set once in initialize) ──────────────
    address identityRegistry;
    address reputationRegistry;

    // ── Task type registry ───────────────────────────────────────
    mapping(uint8 => TypeConfig) taskTypeConfigs;

    // ── Reentrancy guard (replaces ReentrancyGuardUpgradeable) ───
    bool _locked;

    // ── v3.1 append: ERC-8004 reputation attestation ─────────────
    mapping(uint256 => bool) reputationAttested; // bountyId → feedback already given
}

/// @title ClaudelanceStorageV3
/// @notice Abstract base that exposes the EIP-7201 storage accessor.
///         All contracts in the v3 family inherit this for state access.
abstract contract ClaudelanceStorageV3 {
    // keccak256(abi.encode(uint256(keccak256(bytes("claudelance.core.v3"))) - 1)) & ~bytes32(uint256(0xff))
    // Computed via: cast keccak + python EIP-7201 formula
    bytes32 private constant _STORAGE_SLOT =
        0x7ab7ff2bfa5e2dd98317271785b381fe1fdd5645716d0d5e600e63a74bb79e00;

    function _s() internal pure returns (CoreStorage storage s) {
        bytes32 slot = _STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := slot
        }
    }
}
