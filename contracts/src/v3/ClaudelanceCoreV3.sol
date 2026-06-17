// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

// OZ v5: Initializable + UUPSUpgradeable live in the MAIN contracts package
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
// Ownable2Step + Pausable retain the Upgradeable suffix in the upgradeable package
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
// OZ v5 dropped ReentrancyGuardUpgradeable - reentrancy flag lives in CoreStorage instead

import { IClaudelanceCoreV3 } from "./interfaces/IClaudelanceCoreV3.sol";
import { IReputationRegistry } from "./interfaces/IReputationRegistry.sol";
import { ClaudelanceStorageV3 } from "./storage/ClaudelanceStorageV3.sol";
import { CoreStorage } from "./storage/ClaudelanceStorageV3.sol";
import { BountyLib } from "./libraries/BountyLib.sol";
import { TaskTypeLib } from "./libraries/TaskTypeLib.sol";
import { EscrowLib } from "./libraries/EscrowLib.sol";
import {
    Bounty,
    Submission,
    TypeConfig,
    PendingAddress,
    BountyStatus,
    TokenNotAllowed,
    TokenAlreadyAllowed,
    TaskTypeNotEnabled,
    InvalidAddress,
    NotRelayer,
    NothingToWithdraw,
    CannotRescueEscrowToken,
    NoPendingChange,
    TimelockNotElapsed,
    ProposalExpired,
    BountyNotExpired,
    BountyNotOpen,
    StakeAlreadySettled,
    NoStakeRequired,
    NoAgentIdentity,
    WinnerInvalid,
    NotClaimer,
    BountyNotResolved,
    AlreadyAttested,
    AgentNotWinner
} from "./types/ClaudelanceTypes.sol";

/// @title ClaudelanceCoreV3
/// @notice UUPS upgradeable implementation of the Claudelance universal AI task marketplace.
///         Supports 10+ task types (code, research, analysis, content, legal, finance…).
///         All state is isolated under an EIP-7201 storage namespace for safe future upgrades.
///
/// @dev Upgrade authority: _authorizeUpgrade is gated to the owner (Safe multisig on mainnet).
///      v2 at 0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423 remains live and independent.
contract ClaudelanceCoreV3 is
    IClaudelanceCoreV3,
    ClaudelanceStorageV3,
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ── Constants ────────────────────────────────────────────────
    uint64 private constant ADMIN_TIMELOCK = 2 days;
    uint64 private constant PROPOSAL_VALIDITY_WINDOW = 14 days;

    // ── Modifiers ────────────────────────────────────────────────

    modifier onlyRelayer() {
        if (msg.sender != _s().ciRelayer) revert NotRelayer();
        _;
    }

    /// @dev Reentrancy guard stored in EIP-7201 namespace (no slot pollution).
    ///      OZ v5 dropped ReentrancyGuardUpgradeable; we own the lock flag.
    modifier nonReentrant() {
        CoreStorage storage s = _s();
        require(!s._locked, "reentrant");
        s._locked = true;
        _;
        s._locked = false;
    }

    // ── Constructor (implementation) ─────────────────────────────

    /// @dev Prevents direct initialization of the implementation contract.
    constructor() {
        _disableInitializers();
    }

    // ── Initializer (proxy) ──────────────────────────────────────

    /// @param _treasury       Protocol fee recipient.
    /// @param _ciRelayer      Address authorized to call attestCI().
    /// @param _owner          Initial owner (Safe multisig on mainnet).
    /// @param _identityReg    ERC-8004 Identity Registry - workers must hold ≥1 NFT.
    /// @param _reputationReg  ERC-8004 Reputation Registry - stored for Phase 2.
    function initialize(
        address _treasury,
        address _ciRelayer,
        address _owner,
        address _identityReg,
        address _reputationReg
    ) external initializer {
        if (_treasury == address(0) || _ciRelayer == address(0) || _owner == address(0)) revert InvalidAddress();
        if (_identityReg == address(0) || _reputationReg == address(0)) revert InvalidAddress();

        // OZ v5: Ownable2StepUpgradeable inherits __Ownable_init(address initialOwner)
        __Ownable_init(_owner);
        __Pausable_init();
        // No __ReentrancyGuard_init - reentrancy flag is in CoreStorage
        // No __UUPSUpgradeable_init - UUPSUpgradeable in OZ v5 is stateless

        CoreStorage storage s = _s();
        s.treasury = _treasury;
        s.ciRelayer = _ciRelayer;
        s.identityRegistry = _identityReg;
        s.reputationRegistry = _reputationReg;

        // Pre-configure all canonical task types (0-10) with sensible defaults
        for (uint8 i = 0; i <= TaskTypeLib.MAX_CANONICAL_TYPE; i++) {
            s.taskTypeConfigs[i] = TaskTypeLib.defaultConfig(i);
        }

        emit TreasuryUpdated(address(0), _treasury);
        emit CIRelayerUpdated(address(0), _ciRelayer);
    }

    // ─────────────────────────────────────────────────────────────
    // Poster: postBounty / postDirectHire
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
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
    ) external whenNotPaused nonReentrant returns (uint256) {
        return _post(
            token,
            address(0),
            bountyType,
            targetRepoUrl,
            instructionUrl,
            requirementsHash,
            amount,
            maxSlots,
            stake,
            deadlineSeconds,
            ciRequired
        );
    }

    /// @inheritdoc IClaudelanceCoreV3
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
    ) external whenNotPaused nonReentrant returns (uint256) {
        if (targetWorker == address(0)) revert InvalidAddress();
        return _post(
            token,
            targetWorker,
            bountyType,
            targetRepoUrl,
            instructionUrl,
            requirementsHash,
            amount,
            1, // maxSlots forced to 1 for direct hire
            stake,
            deadlineSeconds,
            false // ciRequired forced to false for direct hire
        );
    }

    /// @dev Internal posting logic shared by postBounty and postDirectHire.
    function _post(
        IERC20 token,
        address targetWorker,
        uint8 bountyType,
        string calldata targetRepoUrl,
        string calldata instructionUrl,
        bytes32 requirementsHash,
        uint96 amount,
        uint8 maxSlots,
        uint96 stake,
        uint64 deadlineSeconds,
        bool ciRequired
    ) private returns (uint256 bountyId) {
        CoreStorage storage s = _s();
        address tokenAddr = address(token);

        if (!s.allowedToken[tokenAddr]) revert TokenNotAllowed();

        TypeConfig storage typeCfg = s.taskTypeConfigs[bountyType];
        if (!typeCfg.enabled) revert TaskTypeNotEnabled();

        BountyLib.validatePostParams(amount, s.minBounty[tokenAddr], stake, maxSlots, deadlineSeconds, targetRepoUrl, instructionUrl);

        // If the task type doesn't support CI, force ciRequired off
        bool effectiveCiRequired = typeCfg.ciSupported ? ciRequired : false;

        bountyId = ++s.bountyCount;
        Bounty storage b = s.bounties[bountyId];
        b.poster = msg.sender;
        b.token = tokenAddr;
        b.amount = amount;
        b.stakeRequired = stake;
        b.deadline = uint64(block.timestamp) + deadlineSeconds;
        b.maxSlots = maxSlots;
        b.bountyType = bountyType;
        b.ciRequired = effectiveCiRequired;
        b.targetWorker = targetWorker;
        b.status = BountyStatus.Open;
        b.requirementsHash = requirementsHash;
        b.targetRepoUrl = targetRepoUrl;
        b.instructionUrl = instructionUrl;

        // Stats
        s.totalBountyVolume[tokenAddr] += amount;
        s.bountyCountByType[bountyType]++;
        if (!s.hasPosted[msg.sender]) {
            s.hasPosted[msg.sender] = true;
            s.uniquePosterCount++;
        }

        // Pull escrow
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit BountyPosted(bountyId, msg.sender, tokenAddr, bountyType, amount, maxSlots, targetRepoUrl, requirementsHash);
    }

    // ─────────────────────────────────────────────────────────────
    // Worker: claimSlot / submitDeliverable / withdrawEarnings
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function claimSlot(uint256 bountyId) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Bounty storage b = s.bounties[bountyId];

        BountyLib.validateClaim(b, msg.sender, s.hasClaimed[bountyId][msg.sender]);

        // ERC-8004 identity gate
        if (IERC721(s.identityRegistry).balanceOf(msg.sender) == 0) revert NoAgentIdentity();

        s.hasClaimed[bountyId][msg.sender] = true;
        s.claimers[bountyId].push(msg.sender);
        b.claimedSlots++;

        if (!s.hasWorked[msg.sender]) {
            s.hasWorked[msg.sender] = true;
            s.uniqueWorkerCount++;
        }

        // Pull stake from worker
        IERC20(b.token).safeTransferFrom(msg.sender, address(this), b.stakeRequired);

        emit SlotClaimed(bountyId, msg.sender);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function submitDeliverable(
        uint256 bountyId,
        string calldata deliverableUrl,
        bytes32 deliverableHash,
        string calldata metadata
    ) external whenNotPaused {
        CoreStorage storage s = _s();
        Bounty storage b = s.bounties[bountyId];
        Submission storage sub = s.submissions[bountyId][msg.sender];

        BountyLib.validateSubmit(b, s.hasClaimed[bountyId][msg.sender], sub.submittedAt != 0, deliverableUrl, deliverableHash);

        sub.deliverableUrl = deliverableUrl;
        sub.deliverableHash = deliverableHash;
        sub.metadata = metadata;
        sub.submittedAt = uint64(block.timestamp);

        emit DeliverableSubmitted(bountyId, msg.sender, deliverableUrl, deliverableHash);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function withdrawEarnings(IERC20 token) external nonReentrant {
        CoreStorage storage s = _s();
        uint256 amount = s.earnings[msg.sender][address(token)];
        if (amount == 0) revert NothingToWithdraw();
        s.earnings[msg.sender][address(token)] = 0;
        token.safeTransfer(msg.sender, amount);
        emit EarningsWithdrawn(msg.sender, address(token), amount);
    }

    // ─────────────────────────────────────────────────────────────
    // Relayer: attestCI
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function attestCI(uint256 bountyId, address worker, bool passed) external onlyRelayer {
        CoreStorage storage s = _s();
        if (s.bounties[bountyId].status != BountyStatus.Open) revert BountyNotOpen();
        s.submissions[bountyId][worker].ciPassed = passed;
        emit CIAttested(bountyId, worker, passed);
    }

    // ─────────────────────────────────────────────────────────────
    // Poster: pickWinner / cancelExpired
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function pickWinner(uint256 bountyId, address winner) external nonReentrant {
        CoreStorage storage s = _s();
        Bounty storage b = s.bounties[bountyId];

        BountyLib.validatePickWinner(
            b,
            msg.sender,
            winner,
            s.hasClaimed[bountyId][winner],
            s.submissions[bountyId][winner].submittedAt != 0
        );

        // If CI is required, winner must have passed CI
        if (b.ciRequired && !s.submissions[bountyId][winner].ciPassed) revert WinnerInvalid();

        b.status = BountyStatus.Resolved;
        b.winner = winner;

        (uint96 fee, uint96 payout) = EscrowLib.calcFeeAndPayout(b.amount);

        // Credit winner and treasury (pull pattern)
        s.earnings[winner][b.token] += payout;
        s.earnings[s.treasury][b.token] += fee;

        // Update protocol revenue stats
        s.totalProtocolRevenue[b.token] += fee;
        uint256 cumulative = s.totalProtocolRevenue[b.token];
        s.totalBountiesResolved++;

        emit BountyResolved(bountyId, winner, b.token, payout, fee);
        emit ProtocolRevenueAccrued(b.token, fee, cumulative);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function cancelExpired(uint256 bountyId) external nonReentrant {
        CoreStorage storage s = _s();
        Bounty storage b = s.bounties[bountyId];

        BountyLib.validateCancel(b);

        b.status = BountyStatus.Cancelled;

        // Refund poster escrow
        IERC20(b.token).safeTransfer(b.poster, b.amount);

        emit BountyCancelled(bountyId);
    }

    // ─────────────────────────────────────────────────────────────
    // Permissionless: settleStake
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function settleStake(uint256 bountyId, address worker) external nonReentrant {
        CoreStorage storage s = _s();
        Bounty storage b = s.bounties[bountyId];
        Submission storage sub = s.submissions[bountyId][worker];

        BountyLib.validateSettleStake(b);
        if (b.stakeRequired == 0) revert NoStakeRequired();
        if (!s.hasClaimed[bountyId][worker]) revert NotClaimer();
        if (sub.stakeSettled) revert StakeAlreadySettled();

        sub.stakeSettled = true;

        bool forfeited;
        if (b.status == BountyStatus.Resolved) {
            // Winner gets stake back; losers forfeit if CI failed or no submission
            bool goodFaith = (worker == b.winner) || (sub.submittedAt != 0 && (!b.ciRequired || sub.ciPassed));
            forfeited = !goodFaith;
        } else {
            // Cancelled: refund all stakes
            forfeited = false;
        }

        if (forfeited) {
            s.earnings[s.treasury][b.token] += b.stakeRequired;
            s.totalProtocolRevenue[b.token] += b.stakeRequired;
        } else {
            // Return stake to worker (pull pattern)
            s.earnings[worker][b.token] += b.stakeRequired;
        }

        emit StakeSettled(bountyId, worker, forfeited, b.stakeRequired);
    }

    /// @inheritdoc IClaudelanceCoreV3
    /// @dev Deliberately outside pickWinner: the escrow payout must never be
    ///      blockable by the external registry, and the registry has no
    ///      address→agentId lookup so the caller supplies it (verified via
    ///      ownerOf). whenNotPaused gives the owner a brake on the only
    ///      outbound external call the protocol makes.
    function attestReputation(uint256 bountyId, uint256 agentId) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Bounty storage b = s.bounties[bountyId];

        if (b.status != BountyStatus.Resolved) revert BountyNotResolved();
        if (s.reputationAttested[bountyId]) revert AlreadyAttested();
        if (IERC721(s.identityRegistry).ownerOf(agentId) != b.winner) revert AgentNotWinner();

        s.reputationAttested[bountyId] = true;

        Submission storage sub = s.submissions[bountyId][b.winner];
        IReputationRegistry(s.reputationRegistry).giveFeedback(
            agentId,
            1,
            0,
            "claudelance",
            Strings.toString(b.bountyType),
            "",
            sub.deliverableUrl,
            sub.deliverableHash
        );

        emit ReputationAttested(bountyId, agentId, b.winner);
    }

    // ─────────────────────────────────────────────────────────────
    // Admin: token whitelist
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function allowToken(IERC20 token, uint256 minBountyAmount) external onlyOwner {
        address t = address(token);
        if (t == address(0)) revert InvalidAddress();
        CoreStorage storage s = _s();
        if (s.allowedToken[t]) revert TokenAlreadyAllowed();
        s.allowedToken[t] = true;
        s.minBounty[t] = minBountyAmount;
        emit TokenAllowed(t, minBountyAmount);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function setMinBounty(IERC20 token, uint256 minBountyAmount) external onlyOwner {
        address t = address(token);
        CoreStorage storage s = _s();
        if (!s.allowedToken[t]) revert TokenNotAllowed();
        s.minBounty[t] = minBountyAmount;
        emit MinBountyUpdated(t, minBountyAmount);
    }

    // ─────────────────────────────────────────────────────────────
    // Admin: task type registry
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function configureTaskType(uint8 typeId, TypeConfig calldata config) external onlyOwner {
        _s().taskTypeConfigs[typeId] = config;
        emit TaskTypeConfigured(typeId, config);
    }

    // ─────────────────────────────────────────────────────────────
    // Admin: treasury rotation (2-day timelock)
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function proposeTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        uint64 effectiveAt = uint64(block.timestamp) + ADMIN_TIMELOCK;
        _s().pendingTreasury = PendingAddress({
            proposed: newTreasury,
            effectiveAt: effectiveAt,
            expiresAt: effectiveAt + PROPOSAL_VALIDITY_WINDOW
        });
        emit TreasuryProposed(newTreasury, effectiveAt);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function applyTreasury() external {
        CoreStorage storage s = _s();
        PendingAddress memory p = s.pendingTreasury;
        if (p.proposed == address(0)) revert NoPendingChange();
        if (block.timestamp < p.effectiveAt) revert TimelockNotElapsed();
        if (block.timestamp > p.expiresAt) revert ProposalExpired();
        address prev = s.treasury;
        s.treasury = p.proposed;
        delete s.pendingTreasury;
        emit TreasuryUpdated(prev, p.proposed);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function cancelPendingTreasury() external onlyOwner {
        if (_s().pendingTreasury.proposed == address(0)) revert NoPendingChange();
        delete _s().pendingTreasury;
    }

    // ─────────────────────────────────────────────────────────────
    // Admin: CI relayer rotation (2-day timelock)
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function proposeCIRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert InvalidAddress();
        uint64 effectiveAt = uint64(block.timestamp) + ADMIN_TIMELOCK;
        _s().pendingCIRelayer = PendingAddress({
            proposed: newRelayer,
            effectiveAt: effectiveAt,
            expiresAt: effectiveAt + PROPOSAL_VALIDITY_WINDOW
        });
        emit CIRelayerProposed(newRelayer, effectiveAt);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function applyCIRelayer() external {
        CoreStorage storage s = _s();
        PendingAddress memory p = s.pendingCIRelayer;
        if (p.proposed == address(0)) revert NoPendingChange();
        if (block.timestamp < p.effectiveAt) revert TimelockNotElapsed();
        if (block.timestamp > p.expiresAt) revert ProposalExpired();
        address prev = s.ciRelayer;
        s.ciRelayer = p.proposed;
        delete s.pendingCIRelayer;
        emit CIRelayerUpdated(prev, p.proposed);
    }

    /// @inheritdoc IClaudelanceCoreV3
    function cancelPendingCIRelayer() external onlyOwner {
        if (_s().pendingCIRelayer.proposed == address(0)) revert NoPendingChange();
        delete _s().pendingCIRelayer;
    }

    // ─────────────────────────────────────────────────────────────
    // Admin: circuit breaker + rescue
    // ─────────────────────────────────────────────────────────────

    /// @inheritdoc IClaudelanceCoreV3
    function pause() external onlyOwner { _pause(); }

    /// @inheritdoc IClaudelanceCoreV3
    function unpause() external onlyOwner { _unpause(); }

    /// @inheritdoc IClaudelanceCoreV3
    function rescueERC20(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (_s().allowedToken[address(token)]) revert CannotRescueEscrowToken();
        token.safeTransfer(to, amount);
    }

    // ─────────────────────────────────────────────────────────────
    // UUPS upgrade gate
    // ─────────────────────────────────────────────────────────────

    /// @dev Only the owner (Safe multisig on mainnet) can authorize upgrades.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ─────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return _s().bounties[bountyId];
    }

    function getSubmission(uint256 bountyId, address worker) external view returns (Submission memory) {
        return _s().submissions[bountyId][worker];
    }

    function getClaimers(uint256 bountyId) external view returns (address[] memory) {
        return _s().claimers[bountyId];
    }

    function getEligibleSubmissions(uint256 bountyId) external view returns (address[] memory) {
        CoreStorage storage s = _s();
        Bounty storage b = s.bounties[bountyId];
        address[] storage claimers = s.claimers[bountyId];
        uint256 len = claimers.length;

        address[] memory eligible = new address[](len);
        uint256 count;
        for (uint256 i; i < len; ++i) {
            address w = claimers[i];
            Submission storage sub = s.submissions[bountyId][w];
            if (sub.submittedAt != 0 && (!b.ciRequired || sub.ciPassed)) {
                eligible[count++] = w;
            }
        }

        assembly { mstore(eligible, count) }
        return eligible;
    }

    function getStats(address token)
        external
        view
        returns (uint256 volume, uint256 revenue, uint256 resolved, uint256 posters, uint256 workers)
    {
        CoreStorage storage s = _s();
        volume = s.totalBountyVolume[token];
        revenue = s.totalProtocolRevenue[token];
        resolved = s.totalBountiesResolved;
        posters = s.uniquePosterCount;
        workers = s.uniqueWorkerCount;
    }

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
        )
    {
        CoreStorage storage s = _s();
        volume = s.totalBountyVolume[token];
        revenue = s.totalProtocolRevenue[token];
        resolved = s.totalBountiesResolved;
        posters = s.uniquePosterCount;
        workers = s.uniqueWorkerCount;
        for (uint8 i; i <= TaskTypeLib.MAX_CANONICAL_TYPE; ++i) {
            countByType[i] = s.bountyCountByType[i];
        }
    }

    function getTaskTypeConfig(uint8 typeId) external view returns (TypeConfig memory) {
        return _s().taskTypeConfigs[typeId];
    }

    function isReputationAttested(uint256 bountyId) external view returns (bool) {
        return _s().reputationAttested[bountyId];
    }

    function version() external pure returns (string memory) {
        return "3.1.0";
    }
}
