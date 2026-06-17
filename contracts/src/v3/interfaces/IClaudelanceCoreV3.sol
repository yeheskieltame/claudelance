// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Bounty, Submission, TypeConfig } from "../types/ClaudelanceTypes.sol";

/// @title IClaudelanceCoreV3
/// @notice Public ABI for ClaudelanceCoreV3. All downstream tooling (SDK, relayer,
///         frontend) targets this interface, not the implementation directly.
interface IClaudelanceCoreV3 {
    // ─────────────────────────────────────────────────────────────
    // Events - indexed fields are relayer/frontend hot paths
    // ─────────────────────────────────────────────────────────────

    event BountyPosted(
        uint256 indexed bountyId,
        address indexed poster,
        address indexed token,
        uint8 bountyType,
        uint96 amount,
        uint8 maxSlots,
        string targetRepoUrl,
        bytes32 requirementsHash
    );

    event SlotClaimed(uint256 indexed bountyId, address indexed worker);

    event DeliverableSubmitted(
        uint256 indexed bountyId,
        address indexed worker,
        string deliverableUrl,
        bytes32 deliverableHash
    );

    event CIAttested(uint256 indexed bountyId, address indexed worker, bool passed);

    event BountyResolved(
        uint256 indexed bountyId,
        address indexed winner,
        address indexed token,
        uint96 winnerPayout,
        uint96 protocolFee
    );

    event BountyCancelled(uint256 indexed bountyId);

    event StakeSettled(uint256 indexed bountyId, address indexed worker, bool forfeited, uint96 amount);

    event EarningsWithdrawn(address indexed worker, address indexed token, uint256 amount);

    event ProtocolRevenueAccrued(address indexed token, uint256 amount, uint256 cumulative);

    event TokenAllowed(address indexed token, uint256 minBounty);

    event MinBountyUpdated(address indexed token, uint256 minBounty);

    event TaskTypeConfigured(uint8 indexed typeId, TypeConfig config);

    event TreasuryProposed(address indexed proposed, uint64 effectiveAt);

    event TreasuryUpdated(address indexed previous, address indexed next);

    event CIRelayerProposed(address indexed proposed, uint64 effectiveAt);

    event CIRelayerUpdated(address indexed previous, address indexed next);

    event ReputationAttested(uint256 indexed bountyId, uint256 indexed agentId, address indexed worker);

    // ─────────────────────────────────────────────────────────────
    // Poster functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Open-market bounty. Any ERC-8004 registered agent can claim a slot.
    function postBounty(
        IERC20 token,
        uint8 bountyType,
        string calldata targetRepoUrl,
        string calldata instructionUrl,
        bytes32 requirementsHash,
        uint96 amount,
        uint8 maxSlots,
        uint96 stake,
        uint64 deadlineSeconds,
        bool ciRequired
    ) external returns (uint256 bountyId);

    /// @notice Direct-hire bounty. Only `targetWorker` can claim.
    ///         Forces maxSlots=1; ciRequired is overridden to false.
    function postDirectHire(
        IERC20 token,
        address targetWorker,
        uint8 bountyType,
        string calldata targetRepoUrl,
        string calldata instructionUrl,
        bytes32 requirementsHash,
        uint96 amount,
        uint96 stake,
        uint64 deadlineSeconds
    ) external returns (uint256 bountyId);

    /// @notice Poster selects the winning submission and triggers payout.
    function pickWinner(uint256 bountyId, address winner) external;

    /// @notice Cancel an unresolved bounty after deadline + grace period.
    ///         Refunds the escrow to the poster.
    function cancelExpired(uint256 bountyId) external;

    // ─────────────────────────────────────────────────────────────
    // Worker functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Claim a slot. Worker must hold an ERC-8004 Identity NFT.
    function claimSlot(uint256 bountyId) external;

    /// @notice Submit a deliverable. Replaces v2 submitPR().
    ///         deliverableUrl: GitHub PR, Gist, IPFS, or Arweave URL
    ///         deliverableHash: keccak256 of content (or git commit SHA for code)
    function submitDeliverable(
        uint256 bountyId,
        string calldata deliverableUrl,
        bytes32 deliverableHash,
        string calldata metadata
    ) external;

    /// @notice Pull accrued earnings for a given token.
    function withdrawEarnings(IERC20 token) external;

    // ─────────────────────────────────────────────────────────────
    // Permissionless (anyone)
    // ─────────────────────────────────────────────────────────────

    /// @notice Settle stake for a worker after a bounty is resolved or cancelled.
    ///         Pull pattern - anyone can call; winner/loser determination is on-chain.
    function settleStake(uint256 bountyId, address worker) external;

    /// @notice Write +1 ERC-8004 reputation feedback for a resolved bounty's winner.
    ///         Anyone can call; `agentId` must be an Identity NFT owned by the winner
    ///         (the registry has no reverse lookup, so the caller supplies it).
    ///         Once per bounty; the registry records this contract as the client.
    function attestReputation(uint256 bountyId, uint256 agentId) external;

    // ─────────────────────────────────────────────────────────────
    // Relayer functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Record CI pass/fail. Only callable by the designated ciRelayer.
    ///         For non-CI-required bounties, relayer may call with passed=false
    ///         to flag a disclaimerRequired violation (types 8 & 9).
    function attestCI(uint256 bountyId, address worker, bool passed) external;

    // ─────────────────────────────────────────────────────────────
    // Admin - immediate (onlyOwner)
    // ─────────────────────────────────────────────────────────────

    /// @notice Whitelist a token. One-way: cannot be disabled after enable.
    function allowToken(IERC20 token, uint256 minBountyAmount) external;

    /// @notice Adjust the per-token floor. Only affects future bounties.
    function setMinBounty(IERC20 token, uint256 minBountyAmount) external;

    /// @notice Register or update a task type configuration.
    ///         Types 0-10 are pre-configured at initialization with sensible defaults.
    function configureTaskType(uint8 typeId, TypeConfig calldata config) external;

    // ─────────────────────────────────────────────────────────────
    // Admin - timelocked (2-day lock + 14-day validity window)
    // ─────────────────────────────────────────────────────────────

    function proposeTreasury(address newTreasury) external;
    function applyTreasury() external;
    function cancelPendingTreasury() external;

    function proposeCIRelayer(address newRelayer) external;
    function applyCIRelayer() external;
    function cancelPendingCIRelayer() external;

    // ─────────────────────────────────────────────────────────────
    // Admin - circuit breaker
    // ─────────────────────────────────────────────────────────────

    function pause() external;
    function unpause() external;

    /// @notice Rescue non-escrowed ERC20 tokens accidentally sent to the contract.
    function rescueERC20(IERC20 token, address to, uint256 amount) external;

    // ─────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────

    function getBounty(uint256 bountyId) external view returns (Bounty memory);

    function getSubmission(uint256 bountyId, address worker) external view returns (Submission memory);

    function getClaimers(uint256 bountyId) external view returns (address[] memory);

    function getEligibleSubmissions(uint256 bountyId) external view returns (address[] memory);

    /// @notice Per-token stats (v2-compatible shape).
    function getStats(address token)
        external
        view
        returns (
            uint256 volume,
            uint256 revenue,
            uint256 resolved,
            uint256 posters,
            uint256 workers
        );

    /// @notice Extended stats with per-type resolved counts.
    function getStatsV3(address token)
        external
        view
        returns (
            uint256 volume,
            uint256 revenue,
            uint256 resolved,
            uint256 posters,
            uint256 workers,
            uint256[11] memory countByType
        );

    function getTaskTypeConfig(uint8 typeId) external view returns (TypeConfig memory);

    function isReputationAttested(uint256 bountyId) external view returns (bool);

    /// @notice Implementation version behind the proxy, for upgrade verification.
    function version() external pure returns (string memory);
}
