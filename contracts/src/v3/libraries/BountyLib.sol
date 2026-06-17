// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    Bounty,
    BountyStatus,
    InvalidAmount,
    InvalidStake,
    InvalidSlots,
    InvalidDeadline,
    InvalidAddress,
    InvalidUrl,
    BountyNotOpen,
    DeadlinePassed,
    SlotsFull,
    NotTargetedWorker,
    AlreadyClaimed,
    NotClaimer,
    NoSubmission,
    AlreadySubmitted,
    NotPoster,
    WinnerInvalid,
    BountyNotExpired,
    GracePeriodActive
} from "../types/ClaudelanceTypes.sol";

/// @title BountyLib
/// @notice Pure/view validation helpers for the bounty lifecycle.
///         All functions revert on invalid state - no return values for validation.
library BountyLib {
    uint64 internal constant MIN_DEADLINE = 1 days;
    uint64 internal constant MAX_DEADLINE = 14 days;
    uint8 internal constant MAX_SLOTS = 20;
    uint64 internal constant RESOLUTION_GRACE_PERIOD = 3 days;

    // ── Post validation ──────────────────────────────────────────

    function validatePostParams(
        uint96 amount,
        uint256 minBounty,
        uint96 stake,
        uint8 maxSlots,
        uint64 deadlineSeconds,
        string calldata targetRepoUrl,
        string calldata instructionUrl
    ) internal pure {
        if (amount == 0 || amount < minBounty) revert InvalidAmount();
        if (stake == 0) revert InvalidStake();
        if (maxSlots == 0 || maxSlots > MAX_SLOTS) revert InvalidSlots();
        if (deadlineSeconds < MIN_DEADLINE || deadlineSeconds > MAX_DEADLINE) revert InvalidDeadline();
        if (bytes(targetRepoUrl).length == 0) revert InvalidUrl();
        if (bytes(instructionUrl).length == 0) revert InvalidUrl();
    }

    // ── Claim validation ─────────────────────────────────────────

    function validateClaim(
        Bounty storage bounty,
        address worker,
        bool hasClaimed
    ) internal view {
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp >= bounty.deadline) revert DeadlinePassed();
        if (bounty.claimedSlots >= bounty.maxSlots) revert SlotsFull();
        if (bounty.targetWorker != address(0) && bounty.targetWorker != worker) revert NotTargetedWorker();
        if (hasClaimed) revert AlreadyClaimed();
    }

    // ── Submit validation ────────────────────────────────────────

    function validateSubmit(
        Bounty storage bounty,
        bool hasClaimed,
        bool hasExistingSubmission,
        string calldata deliverableUrl,
        bytes32 deliverableHash
    ) internal view {
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp >= bounty.deadline) revert DeadlinePassed();
        if (!hasClaimed) revert NotClaimer();
        if (hasExistingSubmission) revert AlreadySubmitted();
        if (bytes(deliverableUrl).length == 0) revert InvalidUrl();
        if (deliverableHash == bytes32(0)) revert InvalidUrl();
    }

    // ── Pick winner validation ───────────────────────────────────

    function validatePickWinner(
        Bounty storage bounty,
        address caller,
        address winner,
        bool winnerHasClaimed,
        bool winnerHasSubmission
    ) internal view {
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (caller != bounty.poster) revert NotPoster();
        if (!winnerHasClaimed || !winnerHasSubmission) revert WinnerInvalid();
    }

    // ── Cancel validation ────────────────────────────────────────

    function validateCancel(Bounty storage bounty) internal view {
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp <= bounty.deadline + RESOLUTION_GRACE_PERIOD) revert GracePeriodActive();
    }

    // ── Settle stake validation ──────────────────────────────────

    function validateSettleStake(Bounty storage bounty) internal view {
        if (bounty.status != BountyStatus.Resolved) {
            // Also allow settle after cancel
            if (bounty.status != BountyStatus.Cancelled) revert BountyNotExpired();
        }
    }
}
