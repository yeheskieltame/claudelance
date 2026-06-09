// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────

enum BountyStatus {
    Open,
    Resolved,
    Cancelled
}

// ─────────────────────────────────────────────────────────
// Structs
// ─────────────────────────────────────────────────────────

/// @dev Storage packing: 4 fixed slots (128 bytes) + 3 dynamic fields.
///      Slot 1: poster (20) + amount (12)
///      Slot 2: winner (20) + stakeRequired (12)
///      Slot 3: token (20) + deadline (8) + maxSlots (1) + claimedSlots (1) + bountyType (1) + ciRequired (1)
///      Slot 4: targetWorker (20) + status (1) [11 bytes free — reserved]
///      Slot 5: requirementsHash (32)
struct Bounty {
    address poster;
    uint96 amount;
    address winner;
    uint96 stakeRequired;
    address token;
    uint64 deadline;
    uint8 maxSlots;
    uint8 claimedSlots;
    uint8 bountyType;
    bool ciRequired;
    address targetWorker;
    BountyStatus status;
    bytes32 requirementsHash;
    string targetRepoUrl;
    string instructionUrl;
}

/// @dev Generalized from v2 Submission: prUrl→deliverableUrl, commitHash→deliverableHash.
struct Submission {
    bytes32 deliverableHash;
    uint64 submittedAt;
    bool ciPassed;
    bool stakeSettled;
    string deliverableUrl;
    string metadata;
}

/// @dev Per-task-type configuration. Registered by owner via configureTaskType().
struct TypeConfig {
    bool enabled;
    bool ciSupported;
    bool disclaimerRequired; // relayer hint: legal (8) and finance (9) types
    uint8 minReviewers;      // 0 = poster-only; reserved for multi-sig quorum
}

/// @dev Timelock slot for admin key rotations.
struct PendingAddress {
    address proposed;
    uint64 effectiveAt; // timestamp after which applyXxx() can be called
    uint64 expiresAt;   // proposal expires if not applied within validity window
}

// ─────────────────────────────────────────────────────────
// Custom errors
// ─────────────────────────────────────────────────────────

error InvalidAmount();
error InvalidStake();
error InvalidSlots();
error InvalidDeadline();
error InvalidAddress();
error InvalidUrl();
error TokenNotAllowed();
error TokenAlreadyAllowed();
error TaskTypeNotEnabled();
error NotTargetedWorker();
error BountyNotOpen();
error BountyNotResolved();
error BountyNotExpired();
error DeadlinePassed();
error GracePeriodActive();
error SlotsFull();
error AlreadyClaimed();
error NotClaimer();
error NoSubmission();
error AlreadySubmitted();
error WinnerInvalid();
error NotPoster();
error NotRelayer();
error NothingToWithdraw();
error NoAgentIdentity();
error CannotRescueEscrowToken();
error StakeAlreadySettled();
error NoStakeRequired();
error NoPendingChange();
error TimelockNotElapsed();
error ProposalExpired();
error AlreadyAttested();
error AgentNotWinner();
