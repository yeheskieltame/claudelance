// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ClaudelanceCoreV3 } from "../../src/v3/ClaudelanceCoreV3.sol";
import { ClaudelanceProxy } from "../../src/v3/ClaudelanceProxy.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MockIdentityRegistry } from "../../src/mocks/MockIdentityRegistry.sol";
import { MockReputationRegistry } from "../../src/mocks/MockReputationRegistry.sol";
import {
    Bounty,
    Submission,
    TypeConfig,
    BountyStatus,
    TokenNotAllowed,
    TokenAlreadyAllowed,
    TaskTypeNotEnabled,
    InvalidAmount,
    InvalidAddress,
    BountyNotOpen,
    WinnerInvalid,
    NotClaimer,
    NothingToWithdraw,
    StakeAlreadySettled,
    NoAgentIdentity,
    DeadlinePassed,
    GracePeriodActive,
    BountyNotResolved,
    AlreadyAttested,
    AgentNotWinner
} from "../../src/v3/types/ClaudelanceTypes.sol";
import { TaskTypeLib } from "../../src/v3/libraries/TaskTypeLib.sol";
import { EscrowLib } from "../../src/v3/libraries/EscrowLib.sol";

contract ClaudelanceCoreV3Test is Test {
    // ── Actors ───────────────────────────────────────────────────
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal relayer = makeAddr("relayer");
    address internal poster = makeAddr("poster");
    address internal worker = makeAddr("worker");
    address internal worker2 = makeAddr("worker2");

    // ── Contracts ────────────────────────────────────────────────
    ClaudelanceCoreV3 internal core;
    MockERC20 internal cUSD;
    MockERC20 internal celo;
    MockIdentityRegistry internal identity;
    MockReputationRegistry internal reputation;

    // ── Constants ────────────────────────────────────────────────
    uint96 constant BOUNTY_AMOUNT = 10e18;
    uint96 constant STAKE_AMOUNT = 1e18;
    uint64 constant DEADLINE_1DAY = 1 days;
    string constant REPO_URL = "https://github.com/owner/repo";
    string constant INSTRUCTION_URL = "https://github.com/owner/repo/issues/1";
    string constant DELIVERABLE_URL = "https://gist.github.com/worker/abc123";
    bytes32 constant DELIVERABLE_HASH = keccak256("deliverable content");
    bytes32 constant REQUIREMENTS_HASH = keccak256("requirements");

    function setUp() public {
        // Deploy mock tokens
        cUSD = new MockERC20("Mock cUSD", "cUSD", 18);
        celo = new MockERC20("Mock CELO", "CELO", 18);

        // Deploy mock identity registry - all holders have 1 NFT
        identity = new MockIdentityRegistry();
        reputation = new MockReputationRegistry();

        // Deploy impl + proxy
        ClaudelanceCoreV3 impl = new ClaudelanceCoreV3();
        bytes memory initData = abi.encodeCall(
            ClaudelanceCoreV3.initialize,
            (treasury, relayer, owner, address(identity), address(reputation))
        );
        ClaudelanceProxy proxy = new ClaudelanceProxy(address(impl), initData);
        core = ClaudelanceCoreV3(address(proxy));

        // Whitelist tokens
        vm.startPrank(owner);
        core.allowToken(IERC20(address(cUSD)), 0.5e18);
        core.allowToken(IERC20(address(celo)), 1e18);
        vm.stopPrank();

        // Fund actors
        cUSD.mint(poster, 1000e18);
        cUSD.mint(worker, 100e18);
        cUSD.mint(worker2, 100e18);
        identity.register(worker);
        identity.register(worker2);

        // Approvals
        vm.prank(poster);  cUSD.approve(address(core), type(uint256).max);
        vm.prank(worker);  cUSD.approve(address(core), type(uint256).max);
        vm.prank(worker2); cUSD.approve(address(core), type(uint256).max);
    }

    // ── Initialization ───────────────────────────────────────────

    function test_init_taskTypeDefaults() public view {
        TypeConfig memory code = core.getTaskTypeConfig(TaskTypeLib.TYPE_CODE);
        assertTrue(code.enabled);
        assertTrue(code.ciSupported);
        assertFalse(code.disclaimerRequired);

        TypeConfig memory research = core.getTaskTypeConfig(TaskTypeLib.TYPE_RESEARCH);
        assertTrue(research.enabled);
        assertFalse(research.ciSupported);
        assertFalse(research.disclaimerRequired);

        TypeConfig memory legal = core.getTaskTypeConfig(TaskTypeLib.TYPE_LEGAL);
        assertTrue(legal.enabled);
        assertFalse(legal.ciSupported);
        assertTrue(legal.disclaimerRequired);

        TypeConfig memory finance = core.getTaskTypeConfig(TaskTypeLib.TYPE_FINANCE);
        assertTrue(finance.enabled);
        assertTrue(finance.disclaimerRequired);

        // Type above canonical range is disabled
        TypeConfig memory unknown = core.getTaskTypeConfig(200);
        assertFalse(unknown.enabled);
    }

    function test_init_cannotReinitialize() public {
        vm.expectRevert();
        core.initialize(treasury, relayer, owner, address(identity), address(identity));
    }

    // ── Token whitelist ──────────────────────────────────────────

    function test_allowToken_revertsIfAlreadyAllowed() public {
        vm.prank(owner);
        vm.expectRevert(TokenAlreadyAllowed.selector);
        core.allowToken(IERC20(address(cUSD)), 0.5e18);
    }

    function test_allowToken_revertsIfNotOwner() public {
        vm.prank(poster);
        vm.expectRevert();
        core.allowToken(IERC20(address(celo)), 1e18);
    }

    // ── postBounty ───────────────────────────────────────────────

    function test_postBounty_code_success() public {
        vm.prank(poster);
        uint256 id = core.postBounty(
            IERC20(address(cUSD)),
            TaskTypeLib.TYPE_CODE,
            REPO_URL,
            INSTRUCTION_URL,
            REQUIREMENTS_HASH,
            BOUNTY_AMOUNT,
            3,
            STAKE_AMOUNT,
            DEADLINE_1DAY,
            true
        );

        assertEq(id, 1);
        assertEq(cUSD.balanceOf(address(core)), BOUNTY_AMOUNT);

        Bounty memory b = _getBounty(id);
        assertEq(b.poster, poster);
        assertEq(uint8(b.status), uint8(BountyStatus.Open));
        assertTrue(b.ciRequired); // CODE type supports CI
        assertEq(b.bountyType, TaskTypeLib.TYPE_CODE);
    }

    function test_postBounty_research_ciOverriddenFalse() public {
        vm.prank(poster);
        // Research type doesn't support CI - ciRequired is overridden to false
        uint256 id = core.postBounty(
            IERC20(address(cUSD)),
            TaskTypeLib.TYPE_RESEARCH,
            REPO_URL,
            INSTRUCTION_URL,
            REQUIREMENTS_HASH,
            BOUNTY_AMOUNT,
            3,
            STAKE_AMOUNT,
            DEADLINE_1DAY,
            true // requested true but type doesn't support CI
        );

        assertFalse(_getBounty(id).ciRequired); // must be overridden to false
    }

    function test_postBounty_revertsIfTokenNotAllowed() public {
        MockERC20 unknown = new MockERC20("X", "X", 18);
        vm.prank(poster);
        vm.expectRevert(TokenNotAllowed.selector);
        core.postBounty(IERC20(address(unknown)), 0, REPO_URL, INSTRUCTION_URL, REQUIREMENTS_HASH, BOUNTY_AMOUNT, 1, STAKE_AMOUNT, DEADLINE_1DAY, false);
    }

    function test_postBounty_revertsIfTypeDisabled() public {
        vm.prank(poster);
        vm.expectRevert(TaskTypeNotEnabled.selector);
        core.postBounty(IERC20(address(cUSD)), 200, REPO_URL, INSTRUCTION_URL, REQUIREMENTS_HASH, BOUNTY_AMOUNT, 1, STAKE_AMOUNT, DEADLINE_1DAY, false);
    }

    // ── claimSlot ────────────────────────────────────────────────

    function test_claimSlot_success() public {
        uint256 id = _postCodeBounty();

        uint256 workerBalanceBefore = cUSD.balanceOf(worker);
        vm.prank(worker);
        core.claimSlot(id);

        assertEq(cUSD.balanceOf(worker), workerBalanceBefore - STAKE_AMOUNT);
        assertEq(cUSD.balanceOf(address(core)), BOUNTY_AMOUNT + STAKE_AMOUNT);

        address[] memory claimers = core.getClaimers(id);
        assertEq(claimers.length, 1);
        assertEq(claimers[0], worker);
    }

    function test_claimSlot_revertsIfNoIdentity() public {
        uint256 id = _postCodeBounty();
        address noId = makeAddr("noId");
        cUSD.mint(noId, 100e18);
        vm.prank(noId); cUSD.approve(address(core), type(uint256).max);
        vm.prank(noId);
        vm.expectRevert(NoAgentIdentity.selector);
        core.claimSlot(id);
    }

    // ── submitDeliverable ────────────────────────────────────────

    function test_submitDeliverable_success() public {
        uint256 id = _postAndClaim();

        vm.prank(worker);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");

        Submission memory sub = core.getSubmission(id, worker);
        assertEq(sub.deliverableUrl, DELIVERABLE_URL);
        assertEq(sub.deliverableHash, DELIVERABLE_HASH);
        assertGt(sub.submittedAt, 0);
    }

    function test_submitDeliverable_revertsIfNotClaimer() public {
        uint256 id = _postCodeBounty();
        vm.prank(worker);
        vm.expectRevert(NotClaimer.selector);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");
    }

    // ── Full lifecycle: code bounty ──────────────────────────────

    function test_fullLifecycle_code() public {
        uint256 id = _postAndClaim();

        // Submit
        vm.prank(worker);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");

        // Attest CI pass
        vm.prank(relayer);
        core.attestCI(id, worker, true);

        uint256 workerEarningsBefore = 0;
        uint256 treasuryEarningsBefore = 0;

        // Pick winner
        vm.prank(poster);
        core.pickWinner(id, worker);

        (uint96 fee, uint96 payout) = EscrowLib.calcFeeAndPayout(BOUNTY_AMOUNT);

        // Check earnings
        vm.prank(worker);
        core.withdrawEarnings(IERC20(address(cUSD)));
        assertEq(cUSD.balanceOf(worker), (100e18 - STAKE_AMOUNT) + payout);

        // Settle stake
        core.settleStake(id, worker);

        vm.prank(worker);
        core.withdrawEarnings(IERC20(address(cUSD)));
        // Stake refunded to worker (won)
        assertEq(cUSD.balanceOf(worker), (100e18 - STAKE_AMOUNT) + payout + STAKE_AMOUNT);
    }

    function test_fullLifecycle_research() public {
        // Research (type 2): no CI required, poster picks winner directly
        vm.prank(poster);
        uint256 id = core.postBounty(
            IERC20(address(cUSD)),
            TaskTypeLib.TYPE_RESEARCH,
            REPO_URL,
            INSTRUCTION_URL,
            REQUIREMENTS_HASH,
            BOUNTY_AMOUNT,
            3,
            STAKE_AMOUNT,
            DEADLINE_1DAY,
            false
        );

        vm.prank(worker);
        core.claimSlot(id);

        vm.prank(worker);
        core.submitDeliverable(id, "https://gist.github.com/worker/report123", keccak256("report"), "");

        // No attestCI needed for research type
        vm.prank(poster);
        core.pickWinner(id, worker);

        Bounty memory b = _getBounty(id);
        assertEq(uint8(b.status), uint8(BountyStatus.Resolved));
        assertEq(b.winner, worker);
    }

    // ── pickWinner: CI required but not passed ───────────────────

    function test_pickWinner_revertsIfCINotPassed() public {
        uint256 id = _postAndClaim();

        vm.prank(worker);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");

        // CI not attested - should revert
        vm.prank(poster);
        vm.expectRevert(WinnerInvalid.selector);
        core.pickWinner(id, worker);
    }

    // ── Task type config ─────────────────────────────────────────

    function test_configureTaskType_owner() public {
        TypeConfig memory cfg = TypeConfig({ enabled: true, ciSupported: false, disclaimerRequired: true, minReviewers: 2 });
        vm.prank(owner);
        core.configureTaskType(50, cfg);

        TypeConfig memory stored = core.getTaskTypeConfig(50);
        assertTrue(stored.enabled);
        assertEq(stored.minReviewers, 2);
    }

    function test_configureTaskType_revertsIfNotOwner() public {
        TypeConfig memory cfg = TypeConfig({ enabled: true, ciSupported: false, disclaimerRequired: false, minReviewers: 0 });
        vm.prank(poster);
        vm.expectRevert();
        core.configureTaskType(50, cfg);
    }

    // ── submitDeliverable: deadline and paused guards ────────────

    function test_submitDeliverable_revertsAfterDeadline() public {
        uint256 id = _postAndClaim();
        vm.warp(block.timestamp + 2 days); // past deadline (1 day)
        vm.prank(worker);
        vm.expectRevert(DeadlinePassed.selector);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");
    }

    function test_submitDeliverable_revertsWhenPaused() public {
        uint256 id = _postAndClaim();
        vm.prank(owner);
        core.pause();
        vm.prank(worker);
        vm.expectRevert(); // Pausable: EnforcedPause
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");
    }

    // ── settleStake: forfeiture path ─────────────────────────────

    function test_settleStake_forfeitIfCIFailed() public {
        uint256 id = _postAndClaim();

        vm.prank(worker);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");

        // Attest CI fail for worker
        vm.prank(relayer);
        core.attestCI(id, worker, false);

        // Second worker claims, submits, passes CI, wins
        vm.prank(worker2);
        core.claimSlot(id);
        vm.prank(worker2);
        core.submitDeliverable(id, "https://gist.github.com/w2/other", keccak256("other"), "");
        vm.prank(relayer);
        core.attestCI(id, worker2, true);
        vm.prank(poster);
        core.pickWinner(id, worker2);

        // Worker1 stake forfeited (CI failed)
        uint256 treasuryBefore = cUSD.balanceOf(treasury);
        core.settleStake(id, worker);

        // Treasury earnings increased by stake
        vm.prank(treasury);
        core.withdrawEarnings(IERC20(address(cUSD)));
        assertGt(cUSD.balanceOf(treasury), treasuryBefore);
    }

    // ── cancelExpired ────────────────────────────────────────────

    function test_cancelExpired_refundsPoster() public {
        uint256 id = _postCodeBounty();
        uint256 posterBefore = cUSD.balanceOf(poster);

        // Cannot cancel before grace period
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(GracePeriodActive.selector);
        core.cancelExpired(id);

        // After deadline + grace period (1 day + 3 days)
        vm.warp(block.timestamp + 3 days);
        core.cancelExpired(id);

        assertEq(cUSD.balanceOf(poster), posterBefore + BOUNTY_AMOUNT);
        assertEq(uint8(_getBounty(id).status), uint8(BountyStatus.Cancelled));
    }

    // ── Admin timelock: treasury rotation ───────────────────────

    function test_applyTreasury_afterTimelock() public {
        address newTreasury = makeAddr("newTreasury");

        vm.prank(owner);
        core.proposeTreasury(newTreasury);

        // Cannot apply before timelock
        vm.expectRevert();
        core.applyTreasury();

        // Apply after 2 days
        vm.warp(block.timestamp + 2 days + 1);
        core.applyTreasury();

        // Post a bounty to verify new treasury receives fees
        vm.prank(poster);
        uint256 id = core.postBounty(IERC20(address(cUSD)), 0, REPO_URL, INSTRUCTION_URL, REQUIREMENTS_HASH, BOUNTY_AMOUNT, 1, STAKE_AMOUNT, DEADLINE_1DAY, false);
        vm.prank(worker);
        core.claimSlot(id);
        vm.prank(worker);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");
        vm.prank(poster);
        core.pickWinner(id, worker);

        // New treasury has earnings
        vm.prank(newTreasury);
        core.withdrawEarnings(IERC20(address(cUSD)));
        assertGt(cUSD.balanceOf(newTreasury), 0);
    }

    // ── getStatsV3 ───────────────────────────────────────────────

    function test_getStatsV3_countByType() public {
        _postCodeBounty();
        _postCodeBounty();
        vm.prank(poster);
        core.postBounty(IERC20(address(cUSD)), TaskTypeLib.TYPE_RESEARCH, REPO_URL, INSTRUCTION_URL, REQUIREMENTS_HASH, BOUNTY_AMOUNT, 1, STAKE_AMOUNT, DEADLINE_1DAY, false);

        (, , , , , uint256[11] memory counts) = core.getStatsV3(address(cUSD));
        assertEq(counts[TaskTypeLib.TYPE_CODE], 2);
        assertEq(counts[TaskTypeLib.TYPE_RESEARCH], 1);
    }

    // ── attestReputation (v3.1) ──────────────────────────────────

    event ReputationAttested(uint256 indexed bountyId, uint256 indexed agentId, address indexed worker);

    uint256 constant WORKER_AGENT_ID = 1;  // first register() in setUp
    uint256 constant WORKER2_AGENT_ID = 2;

    function test_attestReputation_happyPath() public {
        uint256 id = _resolvedBounty();

        vm.expectEmit(true, true, true, true);
        emit ReputationAttested(id, WORKER_AGENT_ID, worker);
        core.attestReputation(id, WORKER_AGENT_ID);

        assertTrue(core.isReputationAttested(id));
        assertEq(reputation.callCount(), 1);
        assertEq(reputation.lastClient(), address(core));
        assertEq(reputation.lastAgentId(), WORKER_AGENT_ID);
        assertEq(reputation.lastValue(), int128(1));
        assertEq(reputation.lastValueDecimals(), 0);
        assertEq(reputation.lastTag1(), "claudelance");
        assertEq(reputation.lastTag2(), "0"); // TYPE_CODE
        assertEq(reputation.lastFeedbackURI(), DELIVERABLE_URL);
        assertEq(reputation.lastFeedbackHash(), DELIVERABLE_HASH);
    }

    function test_attestReputation_permissionless() public {
        uint256 id = _resolvedBounty();
        vm.prank(makeAddr("anyone"));
        core.attestReputation(id, WORKER_AGENT_ID);
        assertTrue(core.isReputationAttested(id));
    }

    function test_attestReputation_revertsIfNotResolved() public {
        uint256 id = _postAndClaim();
        vm.expectRevert(BountyNotResolved.selector);
        core.attestReputation(id, WORKER_AGENT_ID);
    }

    function test_attestReputation_revertsIfAgentNotWinner() public {
        uint256 id = _resolvedBounty();
        vm.expectRevert(AgentNotWinner.selector);
        core.attestReputation(id, WORKER2_AGENT_ID);
    }

    function test_attestReputation_revertsIfAlreadyAttested() public {
        uint256 id = _resolvedBounty();
        core.attestReputation(id, WORKER_AGENT_ID);
        vm.expectRevert(AlreadyAttested.selector);
        core.attestReputation(id, WORKER_AGENT_ID);
    }

    function test_attestReputation_revertsWhenPaused() public {
        uint256 id = _resolvedBounty();
        vm.prank(owner);
        core.pause();
        vm.expectRevert();
        core.attestReputation(id, WORKER_AGENT_ID);
    }

    function test_attestReputation_registryRevertPropagates() public {
        uint256 id = _resolvedBounty();
        reputation.setRevertOnFeedback(true);
        vm.expectRevert("registry down");
        core.attestReputation(id, WORKER_AGENT_ID);

        // Flag must not stick after the revert; a retry succeeds
        assertFalse(core.isReputationAttested(id));
        reputation.setRevertOnFeedback(false);
        core.attestReputation(id, WORKER_AGENT_ID);
        assertTrue(core.isReputationAttested(id));
    }

    function test_attestReputation_pickWinnerUnaffectedByRegistry() public {
        // Resolution must never depend on the registry: kill it, resolve fine
        reputation.setRevertOnFeedback(true);
        uint256 id = _resolvedBounty();
        assertEq(_getBounty(id).winner, worker);
    }

    function test_upgrade_preservesStateAndAddsAttest() public {
        uint256 id = _resolvedBounty();

        ClaudelanceCoreV3 newImpl = new ClaudelanceCoreV3();
        vm.prank(owner);
        core.upgradeToAndCall(address(newImpl), "");

        assertEq(core.version(), "3.1.0");
        assertEq(_getBounty(id).winner, worker);
        core.attestReputation(id, WORKER_AGENT_ID);
        assertTrue(core.isReputationAttested(id));
    }

    // ── Helpers ──────────────────────────────────────────────────

    function _resolvedBounty() internal returns (uint256 id) {
        id = _postAndClaim();
        vm.prank(worker);
        core.submitDeliverable(id, DELIVERABLE_URL, DELIVERABLE_HASH, "");
        vm.prank(relayer);
        core.attestCI(id, worker, true);
        vm.prank(poster);
        core.pickWinner(id, worker);
    }

    function _postCodeBounty() internal returns (uint256) {
        vm.prank(poster);
        return core.postBounty(
            IERC20(address(cUSD)),
            TaskTypeLib.TYPE_CODE,
            REPO_URL,
            INSTRUCTION_URL,
            REQUIREMENTS_HASH,
            BOUNTY_AMOUNT,
            3,
            STAKE_AMOUNT,
            DEADLINE_1DAY,
            true
        );
    }

    function _postAndClaim() internal returns (uint256) {
        uint256 id = _postCodeBounty();
        vm.prank(worker);
        core.claimSlot(id);
        return id;
    }

    function _getBounty(uint256 id) internal view returns (Bounty memory) {
        return core.getBounty(id);
    }
}
