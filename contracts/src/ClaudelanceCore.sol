// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { IClaudelanceCore } from "./interfaces/IClaudelanceCore.sol";

/// @title ClaudelanceCore
/// @notice Onchain marketplace where AI-agent workers compete to solve GitHub bounties.
///         v2: Multi-token escrow (cUSD / CELO / USDC, whitelist is one-way).
///         Workers must hold an ERC-8004 Identity NFT to claim a slot.
contract ClaudelanceCore is IClaudelanceCore, ReentrancyGuard, Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    /// @notice ERC-8004 Identity Registry. Workers must hold >=1 NFT here to claimSlot.
    ///         Celo Sepolia: 0x8004A818BFB912233c491871b3d84c89A494BD9e
    ///         Celo Mainnet: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
    IERC721 public immutable identityRegistry;

    /// @notice ERC-8004 Reputation Registry. Stored for Phase 2 feedback integration.
    address public immutable reputationRegistry;

    address public ciRelayer;
    address public treasury;

    PendingAddress public pendingTreasury;
    PendingAddress public pendingCIRelayer;

    uint256 public constant PROTOCOL_FEE_BPS = 200;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint8 public constant MAX_SLOTS = 20;
    uint64 public constant MIN_DEADLINE = 1 days;
    uint64 public constant MAX_DEADLINE = 14 days;
    uint64 public constant RESOLUTION_GRACE_PERIOD = 3 days;
    uint64 public constant ADMIN_TIMELOCK = 2 days;
    uint64 public constant PROPOSAL_VALIDITY_WINDOW = 14 days;

    /// @dev One-way: once true, never flipped back. Keeps `rescueERC20` honest
    ///      and stops a malicious owner from stranding live escrows.
    ///
    /// IMPORTANT: whitelisted tokens MUST be non-fee-on-transfer, non-rebasing,
    /// and non-callback (no ERC777/ERC1363 hooks). cUSD, CELO ERC20, and USDC
    /// on Celo all satisfy this. The contract credits `totalBountyVolume[t]`
    /// and `earnings[*][t]` based on the SENT amount, not the received amount,
    /// so a deflationary token would over-credit and brick the last withdrawal.
    mapping(address => bool) public allowedToken;
    mapping(address => uint256) public minBounty;

    mapping(address => uint256) public totalBountyVolume;
    mapping(address => uint256) public totalProtocolRevenue;
    uint256 public totalBountiesResolved;
    uint256 public uniquePosterCount;
    uint256 public uniqueWorkerCount;
    mapping(uint8 => uint256) public bountyCountByType;

    uint256 public bountyCount;
    mapping(uint256 => Bounty) private _bounties;
    mapping(uint256 => address[]) private _claimers;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => mapping(address => Submission)) private _submissions;
    mapping(address => mapping(address => uint256)) public earnings;
    mapping(address => bool) public hasPosted;
    mapping(address => bool) public hasWorked;

    error InvalidAmount();
    error InvalidStake();
    error InvalidSlots();
    error InvalidDeadline();
    error InvalidAddress();
    error InvalidUrl();
    error TokenNotAllowed();
    error TokenAlreadyAllowed();
    error NotTargetedWorker();
    error BountyNotOpen();
    error BountyNotExpired();
    error DeadlinePassed();
    error SlotsFull();
    error AlreadyClaimed();
    error NotClaimer();
    error NoSubmission();
    error AlreadySubmitted();
    error WinnerInvalid();
    error NotPoster();
    error NotRelayer();
    error NothingToWithdraw();
    error GracePeriodActive();
    error CannotRescueEscrowToken();
    error NoPendingChange();
    error TimelockNotElapsed();
    error ProposalExpired();
    error BountyNotResolved();
    error StakeAlreadySettled();
    error NoStakeRequired();
    error NoAgentIdentity();

    modifier onlyRelayer() {
        if (msg.sender != ciRelayer) revert NotRelayer();
        _;
    }

    constructor(
        address _treasury,
        address _ciRelayer,
        address _owner,
        IERC721 _identityRegistry,
        address _reputationRegistry
    ) Ownable(_owner) {
        if (
            _treasury == address(0) || _ciRelayer == address(0) || address(_identityRegistry) == address(0)
                || _reputationRegistry == address(0)
        ) {
            revert InvalidAddress();
        }
        treasury = _treasury;
        ciRelayer = _ciRelayer;
        identityRegistry = _identityRegistry;
        reputationRegistry = _reputationRegistry;

        emit TreasuryUpdated(address(0), _treasury);
        emit CIRelayerUpdated(address(0), _ciRelayer);
    }

    /// @notice Whitelist a token. One-way: cannot be flipped off after enable.
    function allowToken(IERC20 token, uint256 minBountyAmount) external onlyOwner {
        address t = address(token);
        if (t == address(0)) revert InvalidAddress();
        if (allowedToken[t]) revert TokenAlreadyAllowed();
        allowedToken[t] = true;
        minBounty[t] = minBountyAmount;
        emit TokenAllowed(t, minBountyAmount);
    }

    /// @notice Adjust the per-token floor. Only takes effect for future bounties.
    function setMinBounty(IERC20 token, uint256 minBountyAmount) external onlyOwner {
        address t = address(token);
        if (!allowedToken[t]) revert TokenNotAllowed();
        minBounty[t] = minBountyAmount;
        emit MinBountyUpdated(t, minBountyAmount);
    }

    /// @notice Open marketplace bounty. Any ERC-8004 registered agent can claim a slot.
    function postBounty(
        IERC20 token,
        uint8 bountyType,
        string calldata targetRepoUrl,
        string calldata instructionUrl,
        bytes32 requirementsHash,
        uint96 amount,
        uint8 maxSlots,
        uint96 stake,
        uint64 deadline,
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
            deadline,
            ciRequired
        );
    }

    /// @notice Direct-hire bounty. Only `targetWorker` can claim. CI gate is
    ///         skipped (trust-based); maxSlots is forced to 1.
    function postDirectHire(
        IERC20 token,
        address targetWorker,
        uint8 bountyType,
        string calldata targetRepoUrl,
        string calldata instructionUrl,
        bytes32 requirementsHash,
        uint96 amount,
        uint96 stake,
        uint64 deadline
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
            1,
            stake,
            deadline,
            false
        );
    }

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
        uint64 deadline,
        bool ciRequired
    ) internal returns (uint256 bountyId) {
        address t = address(token);
        if (!allowedToken[t]) revert TokenNotAllowed();
        if (amount < minBounty[t]) revert InvalidAmount();
        if (stake == 0) revert InvalidStake();
        if (maxSlots == 0 || maxSlots > MAX_SLOTS) revert InvalidSlots();
        if (deadline < MIN_DEADLINE || deadline > MAX_DEADLINE) revert InvalidDeadline();
        if (bytes(targetRepoUrl).length == 0 || bytes(instructionUrl).length == 0) revert InvalidUrl();

        bountyId = ++bountyCount;
        uint64 absoluteDeadline = uint64(block.timestamp) + deadline;

        _bounties[bountyId] = Bounty({
            poster: msg.sender,
            amount: amount,
            winner: address(0),
            stakeRequired: stake,
            token: t,
            deadline: absoluteDeadline,
            maxSlots: maxSlots,
            claimedSlots: 0,
            bountyType: bountyType,
            ciRequired: ciRequired,
            targetWorker: targetWorker,
            status: BountyStatus.Open,
            targetRepoUrl: targetRepoUrl,
            instructionUrl: instructionUrl,
            requirementsHash: requirementsHash
        });

        totalBountyVolume[t] += amount;
        bountyCountByType[bountyType] += 1;
        if (!hasPosted[msg.sender]) {
            hasPosted[msg.sender] = true;
            uniquePosterCount += 1;
        }

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit BountyPosted(
            bountyId, msg.sender, t, targetWorker, bountyType, amount, stake, maxSlots, targetRepoUrl, requirementsHash
        );
    }

    function claimSlot(uint256 bountyId) external whenNotPaused nonReentrant {
        Bounty storage b = _bounties[bountyId];
        if (b.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp >= b.deadline) revert DeadlinePassed();
        if (b.claimedSlots >= b.maxSlots) revert SlotsFull();
        if (hasClaimed[bountyId][msg.sender]) revert AlreadyClaimed();
        // Direct-hire bounties are gated to the chosen worker.
        if (b.targetWorker != address(0) && msg.sender != b.targetWorker) revert NotTargetedWorker();
        // ERC-8004 gate: workers must be registered AI agents to claim work.
        if (identityRegistry.balanceOf(msg.sender) == 0) revert NoAgentIdentity();

        hasClaimed[bountyId][msg.sender] = true;
        b.claimedSlots += 1;
        _claimers[bountyId].push(msg.sender);

        if (!hasWorked[msg.sender]) {
            hasWorked[msg.sender] = true;
            uniqueWorkerCount += 1;
        }

        if (b.stakeRequired > 0) {
            IERC20(b.token).safeTransferFrom(msg.sender, address(this), b.stakeRequired);
        }

        emit SlotClaimed(bountyId, msg.sender);
    }

    function submitPR(uint256 bountyId, string calldata prUrl, bytes32 commitHash, string calldata metadata)
        external
        whenNotPaused
    {
        Bounty storage b = _bounties[bountyId];
        if (b.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp >= b.deadline) revert DeadlinePassed();
        if (!hasClaimed[bountyId][msg.sender]) revert NotClaimer();
        if (bytes(prUrl).length == 0) revert NoSubmission();

        Submission storage s = _submissions[bountyId][msg.sender];
        // One-shot: blocks the stale-CI-attestation swap attack.
        if (s.submittedAt != 0) revert AlreadySubmitted();

        s.prUrl = prUrl;
        s.commitHash = commitHash;
        s.metadata = metadata;
        s.submittedAt = uint64(block.timestamp);

        emit PRSubmitted(bountyId, msg.sender, prUrl, commitHash);
    }

    function attestCI(uint256 bountyId, address worker, bool passed) external whenNotPaused onlyRelayer {
        Bounty storage b = _bounties[bountyId];
        if (b.status != BountyStatus.Open) revert BountyNotOpen();
        if (!hasClaimed[bountyId][worker]) revert NotClaimer();
        Submission storage s = _submissions[bountyId][worker];
        if (s.submittedAt == 0) revert NoSubmission();

        s.ciPassed = passed;
        emit CIAttested(bountyId, worker, passed);
    }

    /// @notice Resolves the bounty in O(1). Stakes are settled separately via `settleStake`.
    function pickWinner(uint256 bountyId, address winner) external nonReentrant {
        Bounty storage b = _bounties[bountyId];
        if (b.status != BountyStatus.Open) revert BountyNotOpen();
        if (msg.sender != b.poster) revert NotPoster();
        if (!hasClaimed[bountyId][winner]) revert WinnerInvalid();

        Submission storage ws = _submissions[bountyId][winner];
        if (ws.submittedAt == 0) revert WinnerInvalid();
        if (b.ciRequired && !ws.ciPassed) revert WinnerInvalid();

        b.status = BountyStatus.Resolved;
        b.winner = winner;

        address t = b.token;
        uint96 amount = b.amount;
        // forge-lint: disable-next-line(unsafe-typecast)
        uint96 fee = uint96((uint256(amount) * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR);
        uint96 payout = amount - fee;

        earnings[winner][t] += payout;
        if (fee > 0) {
            earnings[treasury][t] += fee;
            uint256 newRevenue = totalProtocolRevenue[t] + fee;
            totalProtocolRevenue[t] = newRevenue;
            emit ProtocolRevenueAccrued(t, fee, newRevenue);
        }
        unchecked {
            ++totalBountiesResolved;
        }

        emit BountyResolved(bountyId, winner, payout, fee);
    }

    /// @notice After `deadline`, anyone may cancel - but during the grace window only the
    ///         poster, so a third party cannot race a passing-CI worker out of their win.
    function cancelExpired(uint256 bountyId) external nonReentrant {
        Bounty storage b = _bounties[bountyId];
        if (b.status != BountyStatus.Open) revert BountyNotOpen();
        uint64 deadline = b.deadline;
        if (block.timestamp < deadline) revert BountyNotExpired();
        address poster_ = b.poster;
        if (block.timestamp < deadline + RESOLUTION_GRACE_PERIOD && msg.sender != poster_) {
            revert GracePeriodActive();
        }

        b.status = BountyStatus.Cancelled;

        uint96 refund = b.amount;
        earnings[poster_][b.token] += refund;
        emit BountyCancelled(bountyId, poster_, refund);
    }

    /// @notice Permissionless stake settlement. Refund-vs-forfeit rules:
    ///         winner -> refund; non-submitter -> forfeit;
    ///         CI required -> refund iff `ciPassed`; CI not required -> refund.
    ///         Forfeits credit `treasury` and bump `totalProtocolRevenue[token]`.
    function settleStake(uint256 bountyId, address worker) external nonReentrant {
        Bounty storage b = _bounties[bountyId];
        BountyStatus status = b.status;
        if (status == BountyStatus.Open) revert BountyNotResolved();
        if (!hasClaimed[bountyId][worker]) revert NotClaimer();
        uint96 stake = b.stakeRequired;
        if (stake == 0) revert NoStakeRequired();

        Submission storage s = _submissions[bountyId][worker];
        if (s.stakeRefunded) revert StakeAlreadySettled();
        s.stakeRefunded = true;

        address t = b.token;
        bool refund;
        if (status == BountyStatus.Resolved && worker == b.winner) {
            refund = true;
        } else if (s.submittedAt == 0) {
            refund = false;
        } else if (b.ciRequired) {
            refund = s.ciPassed;
        } else {
            refund = true;
        }

        if (refund) {
            earnings[worker][t] += stake;
            emit StakeRefunded(bountyId, worker, stake);
        } else {
            earnings[treasury][t] += stake;
            uint256 newRevenue = totalProtocolRevenue[t] + stake;
            totalProtocolRevenue[t] = newRevenue;
            emit StakeForfeited(bountyId, worker, stake);
            emit ProtocolRevenueAccrued(t, stake, newRevenue);
        }
    }

    /// @notice Always callable, even when paused, so users can always exit.
    function withdrawEarnings(IERC20 token) external nonReentrant {
        address t = address(token);
        uint256 amount = earnings[msg.sender][t];
        if (amount == 0) revert NothingToWithdraw();
        earnings[msg.sender][t] = 0;
        emit EarningsWithdrawn(msg.sender, t, amount);
        token.safeTransfer(msg.sender, amount);
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return _bounties[bountyId];
    }

    function getSubmission(uint256 bountyId, address worker) external view returns (Submission memory) {
        return _submissions[bountyId][worker];
    }

    function getClaimers(uint256 bountyId) external view returns (address[] memory) {
        return _claimers[bountyId];
    }

    function getEligibleSubmissions(uint256 bountyId) external view returns (address[] memory eligible) {
        Bounty storage b = _bounties[bountyId];
        address[] storage claimers = _claimers[bountyId];
        uint256 len = claimers.length;

        address[] memory buffer = new address[](len);
        uint256 count;
        for (uint256 i = 0; i < len;) {
            address worker = claimers[i];
            Submission storage s = _submissions[bountyId][worker];
            if (s.submittedAt != 0 && (!b.ciRequired || s.ciPassed)) {
                buffer[count] = worker;
                unchecked {
                    ++count;
                }
            }
            unchecked {
                ++i;
            }
        }

        eligible = new address[](count);
        for (uint256 i = 0; i < count;) {
            eligible[i] = buffer[i];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Per-token marketplace stats. `resolved`, `posters`, `workers` are global.
    function getStats(IERC20 token)
        external
        view
        returns (uint256 volume, uint256 revenue, uint256 resolved, uint256 posters, uint256 workers)
    {
        address t = address(token);
        return
            (totalBountyVolume[t], totalProtocolRevenue[t], totalBountiesResolved, uniquePosterCount, uniqueWorkerCount);
    }

    function proposeCIRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert InvalidAddress();
        uint64 effectiveAt = uint64(block.timestamp) + ADMIN_TIMELOCK;
        pendingCIRelayer = PendingAddress({ proposed: newRelayer, effectiveAt: effectiveAt });
        emit CIRelayerProposed(newRelayer, effectiveAt);
    }

    function applyCIRelayer() external {
        PendingAddress memory p = pendingCIRelayer;
        if (p.proposed == address(0)) revert NoPendingChange();
        if (block.timestamp < p.effectiveAt) revert TimelockNotElapsed();
        if (block.timestamp > uint256(p.effectiveAt) + PROPOSAL_VALIDITY_WINDOW) revert ProposalExpired();
        address previous = ciRelayer;
        ciRelayer = p.proposed;
        delete pendingCIRelayer;
        emit CIRelayerUpdated(previous, p.proposed);
    }

    function cancelPendingCIRelayer() external onlyOwner {
        address proposed = pendingCIRelayer.proposed;
        if (proposed == address(0)) revert NoPendingChange();
        delete pendingCIRelayer;
        emit CIRelayerProposalCancelled(proposed);
    }

    function proposeTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0) || newTreasury == address(this)) revert InvalidAddress();
        uint64 effectiveAt = uint64(block.timestamp) + ADMIN_TIMELOCK;
        pendingTreasury = PendingAddress({ proposed: newTreasury, effectiveAt: effectiveAt });
        emit TreasuryProposed(newTreasury, effectiveAt);
    }

    function applyTreasury() external {
        PendingAddress memory p = pendingTreasury;
        if (p.proposed == address(0)) revert NoPendingChange();
        if (block.timestamp < p.effectiveAt) revert TimelockNotElapsed();
        if (block.timestamp > uint256(p.effectiveAt) + PROPOSAL_VALIDITY_WINDOW) revert ProposalExpired();
        address previous = treasury;
        treasury = p.proposed;
        delete pendingTreasury;
        emit TreasuryUpdated(previous, p.proposed);
    }

    function cancelPendingTreasury() external onlyOwner {
        address proposed = pendingTreasury.proposed;
        if (proposed == address(0)) revert NoPendingChange();
        delete pendingTreasury;
        emit TreasuryProposalCancelled(proposed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescue accidentally-sent ERC20s. Blocks any whitelisted token -
    ///         their balance is held legitimately as bounty / stake / earnings.
    function rescueERC20(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (allowedToken[address(token)]) revert CannotRescueEscrowToken();
        if (to == address(0)) revert InvalidAddress();
        emit ERC20Rescued(address(token), to, amount);
        token.safeTransfer(to, amount);
    }
}
