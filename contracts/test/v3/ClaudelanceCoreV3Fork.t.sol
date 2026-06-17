// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// Fork test - fires against the live ClaudelanceCoreV3 proxy on Celo Sepolia.
//
// Run:
//   CELO_SEPOLIA_RPC=https://forno.celo-sepolia.celo-testnet.org/ \
//   forge test --match-path "test/v3/ClaudelanceCoreV3Fork.t.sol" \
//              --fork-url $CELO_SEPOLIA_RPC -v
//
// Proxy:   0x64b45Fe2C64951013389740AD530e5c664fd0Ffe (chain 11142220)
// Impl:    0x1fb667a40159e4652A89dDFC9ADF3eEcB6F0A572
// ─────────────────────────────────────────────────────────────────────────────

import { Test, console2 } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ClaudelanceCoreV3 } from "../../src/v3/ClaudelanceCoreV3.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import {
    Bounty,
    Submission,
    TypeConfig,
    BountyStatus,
    TokenNotAllowed,
    TokenAlreadyAllowed,
    TaskTypeNotEnabled,
    InvalidAddress,
    BountyNotOpen,
    WinnerInvalid,
    NotClaimer,
    AlreadyClaimed,
    AlreadySubmitted,
    NothingToWithdraw,
    StakeAlreadySettled,
    NoAgentIdentity,
    DeadlinePassed,
    GracePeriodActive,
    SlotsFull,
    NotPoster,
    NotRelayer,
    InvalidUrl,
    CannotRescueEscrowToken,
    NoPendingChange,
    TimelockNotElapsed,
    NotTargetedWorker,
    ProposalExpired,
    AlreadyAttested,
    AgentNotWinner,
    BountyNotResolved
} from "../../src/v3/types/ClaudelanceTypes.sol";
import { TaskTypeLib } from "../../src/v3/libraries/TaskTypeLib.sol";
import { EscrowLib } from "../../src/v3/libraries/EscrowLib.sol";

// Minimal interface for the live ERC-8004 registry (unverified on Celoscan)
interface IErc8004 {
    function register() external returns (uint256);
    function balanceOf(address) external view returns (uint256);
}

// Live ERC-8004 Reputation Registry read surface (for v3.1 attest assertions)
interface IRepRegistry {
    function getClients(uint256 agentId) external view returns (address[] memory);
    function getSummary(uint256 agentId, address[] calldata clients, string calldata tag1, string calldata tag2)
        external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}

contract ClaudelanceCoreV3ForkTest is Test {
    // ── Live Sepolia addresses ────────────────────────────────────
    ClaudelanceCoreV3 internal core =
        ClaudelanceCoreV3(0x64b45Fe2C64951013389740AD530e5c664fd0Ffe);

    MockERC20 internal cUSD = MockERC20(0xeB9595f4d14A4AEB23cc535007c973e50F1307E7);
    MockERC20 internal celo = MockERC20(0x68128f321E01C2388628c549E3a4Ea016DB01968);
    MockERC20 internal usdc = MockERC20(0x71f44190dCE495b663700A3e96909988b8fbF3F9);
    IErc8004 internal identity = IErc8004(0x8004A818BFB912233c491871b3d84c89A494BD9e);

    address internal owner = 0x987e2ed458ddAF6f900362F94558378056dCc226;
    address internal treasury = 0x987e2ed458ddAF6f900362F94558378056dCc226;
    address internal relayer = 0x987e2ed458ddAF6f900362F94558378056dCc226;

    // ── Test actors (fresh addresses with no on-chain state) ─────
    address internal poster  = makeAddr("poster");
    address internal worker  = makeAddr("worker");
    address internal worker2 = makeAddr("worker2");
    address internal worker3 = makeAddr("worker3");
    address internal attacker = makeAddr("attacker");

    // ── Fixture constants ─────────────────────────────────────────
    uint96  constant AMT   = 5e18;   // 5 cUSD bounty
    uint96  constant STAKE = 1e18;   // 1 cUSD stake
    uint64  constant DL    = 1 days;
    string  constant REPO  = "https://github.com/claudelance/test-repo";
    string  constant ISSUE = "https://github.com/claudelance/test-repo/issues/1";
    string  constant GIST  = "https://gist.github.com/worker/abc123";
    bytes32 constant DHASH = keccak256("deliverable");
    bytes32 constant RHASH = keccak256("requirements");

    function setUp() public {
        // ── Ensure fork is active (skips on non-fork runs) ───────
        // If CELO_SEPOLIA_RPC is not set, these tests are skipped
        try vm.envString("CELO_SEPOLIA_RPC") returns (string memory) {}
        catch { vm.skip(true); }

        // ── Fund test actors with tokens via MockERC20.mint() ────
        cUSD.mint(poster,  1000e18);
        cUSD.mint(worker,  100e18);
        cUSD.mint(worker2, 100e18);
        cUSD.mint(worker3, 100e18);

        // ── Register ERC-8004 identities for workers ─────────────
        _registerIdentity(worker);
        _registerIdentity(worker2);
        _registerIdentity(worker3);

        // ── Approve core to pull tokens ──────────────────────────
        vm.prank(poster);  cUSD.approve(address(core), type(uint256).max);
        vm.prank(worker);  cUSD.approve(address(core), type(uint256).max);
        vm.prank(worker2); cUSD.approve(address(core), type(uint256).max);
        vm.prank(worker3); cUSD.approve(address(core), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 1 - Deployment sanity
    // ─────────────────────────────────────────────────────────────

    function test_fork_proxyPointsToImpl() public view {
        bytes32 slot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        bytes32 impl = vm.load(address(core), slot);
        address implAddr = address(uint160(uint256(impl)));
        assertEq(implAddr, 0x1fb667a40159e4652A89dDFC9ADF3eEcB6F0A572);
    }

    function test_fork_taskTypeDefaults() public view {
        TypeConfig memory code = core.getTaskTypeConfig(0);
        assertTrue(code.enabled);
        assertTrue(code.ciSupported);
        assertFalse(code.disclaimerRequired);

        TypeConfig memory research = core.getTaskTypeConfig(2);
        assertTrue(research.enabled);
        assertFalse(research.ciSupported);

        TypeConfig memory legal = core.getTaskTypeConfig(8);
        assertTrue(legal.enabled);
        assertTrue(legal.disclaimerRequired);

        TypeConfig memory finance = core.getTaskTypeConfig(9);
        assertTrue(finance.disclaimerRequired);

        TypeConfig memory unknown = core.getTaskTypeConfig(200);
        assertFalse(unknown.enabled);
    }

    function test_fork_tokensWhitelisted() public {
        // Verify whitelisting indirectly: non-whitelisted token reverts with TokenNotAllowed
        MockERC20 unknown = new MockERC20("X", "X", 18);
        unknown.mint(poster, AMT + STAKE);
        vm.prank(poster); unknown.approve(address(core), type(uint256).max);
        vm.prank(poster);
        vm.expectRevert(TokenNotAllowed.selector);
        core.postBounty(IERC20(address(unknown)), 0, REPO, ISSUE, RHASH, AMT, 1, STAKE, DL, false);

        // Whitelisted tokens do NOT revert (cUSD confirmed by a successful post)
        vm.prank(poster);
        uint256 id = core.postBounty(IERC20(address(cUSD)), 0, REPO, ISSUE, RHASH, AMT, 1, STAKE, DL, false);
        assertGt(id, 0);
    }

    function test_fork_cannotReinitialize() public {
        vm.expectRevert();
        core.initialize(treasury, relayer, owner,
            address(identity), address(identity));
    }

    // ─────────────────────────────────────────────────────────────
    // Section 2 - Happy path: code bounty full lifecycle
    // ─────────────────────────────────────────────────────────────

    function test_fork_codeBounty_fullLifecycle() public {
        uint256 id = _postCode(AMT, 3, true);

        // Two workers compete
        _claim(id, worker);
        _claim(id, worker2);

        _submit(id, worker,  GIST, DHASH);
        _submit(id, worker2, "https://gist.github.com/w2/xyz", keccak256("w2"));

        // Relayer attests: worker1 passes, worker2 fails
        vm.prank(relayer); core.attestCI(id, worker, true);
        vm.prank(relayer); core.attestCI(id, worker2, false);

        // Capture balances AFTER claims (stake already deducted)
        uint256 workerAfterClaim  = cUSD.balanceOf(worker);  // 100e18 - STAKE
        uint256 worker2AfterClaim = cUSD.balanceOf(worker2); // 100e18 - STAKE

        // Pick worker1 as winner
        vm.prank(poster); core.pickWinner(id, worker);

        (uint96 fee, uint96 payout) = EscrowLib.calcFeeAndPayout(AMT);

        // Withdraw winner earnings
        vm.prank(worker); core.withdrawEarnings(IERC20(address(cUSD)));
        // workerAfterClaim already excludes the stake; payout is additional credit
        assertEq(cUSD.balanceOf(worker), workerAfterClaim + payout);

        // Settle stakes: winner refunded, loser (CI failed) forfeited
        core.settleStake(id, worker);
        core.settleStake(id, worker2);

        vm.prank(worker); core.withdrawEarnings(IERC20(address(cUSD)));
        // worker2 CI failed → stake forfeited → no earnings; withdrawEarnings would revert

        // worker1 got payout + stake back
        assertEq(cUSD.balanceOf(worker),  workerAfterClaim + payout + STAKE);
        // worker2 lost stake (CI failed) - balance stays at post-claim level
        assertEq(cUSD.balanceOf(worker2), worker2AfterClaim);

        // Bounty resolved
        assertEq(uint8(core.getBounty(id).status), uint8(BountyStatus.Resolved));
        assertEq(core.getBounty(id).winner, worker);

        // Stats updated
        (,, uint256 resolved,,) = core.getStats(address(cUSD));
        assertGt(resolved, 0);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 3 - Happy path: research bounty (no CI gate)
    // ─────────────────────────────────────────────────────────────

    function test_fork_researchBounty_noCI() public {
        vm.prank(poster);
        uint256 id = core.postBounty(
            IERC20(address(cUSD)), TaskTypeLib.TYPE_RESEARCH,
            REPO, ISSUE, RHASH, AMT, 2, STAKE, DL, true // ciRequired overridden to false
        );
        assertFalse(core.getBounty(id).ciRequired);

        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);

        // No attestCI needed
        vm.prank(poster); core.pickWinner(id, worker);
        assertEq(uint8(core.getBounty(id).status), uint8(BountyStatus.Resolved));
    }

    // ─────────────────────────────────────────────────────────────
    // Section 4 - Direct hire
    // ─────────────────────────────────────────────────────────────

    function test_fork_directHire_onlyTargetCanClaim() public {
        vm.prank(poster);
        uint256 id = core.postDirectHire(
            IERC20(address(cUSD)), worker,
            TaskTypeLib.TYPE_CODE,
            REPO, ISSUE, RHASH, AMT, STAKE, DL
        );

        assertEq(core.getBounty(id).maxSlots, 1);
        assertFalse(core.getBounty(id).ciRequired);

        // Non-target cannot claim
        vm.prank(worker2);
        vm.expectRevert(NotTargetedWorker.selector);
        core.claimSlot(id);

        // Target can claim
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster); core.pickWinner(id, worker);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 5 - Multi-token (CELO, USDC)
    // ─────────────────────────────────────────────────────────────

    function test_fork_celoToken_lifecycle() public {
        celo.mint(poster,  100e18);
        celo.mint(worker,  10e18);
        vm.prank(poster); celo.approve(address(core), type(uint256).max);
        vm.prank(worker);  celo.approve(address(core), type(uint256).max);

        vm.prank(poster);
        uint256 id = core.postBounty(
            IERC20(address(celo)), TaskTypeLib.TYPE_CODE,
            REPO, ISSUE, RHASH, 5e18, 1, 1e18, DL, false
        );

        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster); core.pickWinner(id, worker);

        vm.prank(worker);
        core.withdrawEarnings(IERC20(address(celo)));
        assertGt(celo.balanceOf(worker), 0);
    }

    function test_fork_usdcToken_lifecycle() public {
        usdc.mint(poster, 100e6);
        usdc.mint(worker, 10e6);
        vm.prank(poster); usdc.approve(address(core), type(uint256).max);
        vm.prank(worker);  usdc.approve(address(core), type(uint256).max);

        vm.prank(poster);
        uint256 id = core.postBounty(
            IERC20(address(usdc)), TaskTypeLib.TYPE_CONTENT,
            REPO, ISSUE, RHASH, 1e6, 1, 500000, DL, false
        );

        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster); core.pickWinner(id, worker);

        vm.prank(worker);
        core.withdrawEarnings(IERC20(address(usdc)));
        assertGt(usdc.balanceOf(worker), 0);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 6 - Cancel expired
    // ─────────────────────────────────────────────────────────────

    function test_fork_cancelExpired() public {
        uint256 id = _postCode(AMT, 1, false);
        uint256 posterBefore = cUSD.balanceOf(poster);

        vm.expectRevert(GracePeriodActive.selector);
        core.cancelExpired(id); // grace period not over

        vm.warp(block.timestamp + 1 days + 3 days + 1); // deadline + grace
        core.cancelExpired(id);

        assertEq(cUSD.balanceOf(poster), posterBefore + AMT);
        assertEq(uint8(core.getBounty(id).status), uint8(BountyStatus.Cancelled));
    }

    function test_fork_cancelExpired_stakesRefunded() public {
        uint256 id = _postCode(AMT, 3, false);
        _claim(id, worker);
        _claim(id, worker2);

        // Capture AFTER claim - stake already deducted
        uint256 w1AfterClaim = cUSD.balanceOf(worker);
        uint256 w2AfterClaim = cUSD.balanceOf(worker2);

        vm.warp(block.timestamp + 5 days);
        core.cancelExpired(id);

        // Anyone can settle stakes post-cancel
        core.settleStake(id, worker);
        core.settleStake(id, worker2);

        // Workers get stakes back (cancelled = no forfeiture)
        vm.prank(worker);  core.withdrawEarnings(IERC20(address(cUSD)));
        vm.prank(worker2); core.withdrawEarnings(IERC20(address(cUSD)));

        // stake refunded: post-claim balance + STAKE
        assertEq(cUSD.balanceOf(worker),  w1AfterClaim + STAKE);
        assertEq(cUSD.balanceOf(worker2), w2AfterClaim + STAKE);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 7 - Stats tracking
    // ─────────────────────────────────────────────────────────────

    function test_fork_statsAccumulate() public {
        (uint256 vol0,,,,uint256 workers0) = core.getStats(address(cUSD));
        (,,,,, uint256[11] memory cnt0) = core.getStatsV3(address(cUSD));

        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster); core.pickWinner(id, worker);

        (uint256 vol1,, uint256 res1, uint256 posters1, uint256 workers1) = core.getStats(address(cUSD));
        (,,,,, uint256[11] memory cnt1) = core.getStatsV3(address(cUSD));

        assertEq(vol1, vol0 + AMT);
        assertEq(res1, 1); // this run resolved 1
        assertGe(posters1, 1);
        assertGe(workers1, workers0 + 1);
        assertEq(cnt1[TaskTypeLib.TYPE_CODE], cnt0[TaskTypeLib.TYPE_CODE] + 1);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 8 - Admin: configureTaskType
    // ─────────────────────────────────────────────────────────────

    function test_fork_configureTaskType_enableNew() public {
        // Type 150 is disabled by default
        assertFalse(core.getTaskTypeConfig(150).enabled);

        TypeConfig memory cfg = TypeConfig({
            enabled: true, ciSupported: false,
            disclaimerRequired: false, minReviewers: 0
        });
        vm.prank(owner); core.configureTaskType(150, cfg);
        assertTrue(core.getTaskTypeConfig(150).enabled);

        // Now can post with this type
        vm.prank(poster);
        core.postBounty(IERC20(address(cUSD)), 150, REPO, ISSUE, RHASH, AMT, 1, STAKE, DL, false);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 9 - Admin: treasury rotation timelock
    // ─────────────────────────────────────────────────────────────

    function test_fork_treasuryRotation_fullFlow() public {
        address newTreasury = makeAddr("newTreasury");

        vm.prank(owner); core.proposeTreasury(newTreasury);

        // Too early
        vm.expectRevert(TimelockNotElapsed.selector);
        core.applyTreasury();

        vm.warp(block.timestamp + 2 days + 1);
        core.applyTreasury();

        // Verify fees flow to new treasury
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster); core.pickWinner(id, worker);

        vm.prank(newTreasury);
        core.withdrawEarnings(IERC20(address(cUSD)));
        assertGt(cUSD.balanceOf(newTreasury), 0);
    }

    function test_fork_treasuryRotation_expiry() public {
        address newTreasury = makeAddr("expiredTreasury");
        vm.prank(owner); core.proposeTreasury(newTreasury);

        // Wait past validity window (14 days after timelock)
        vm.warp(block.timestamp + 2 days + 14 days + 1);

        vm.expectRevert();
        core.applyTreasury();
    }

    function test_fork_cancelPendingTreasury() public {
        vm.prank(owner); core.proposeTreasury(makeAddr("t2"));
        vm.prank(owner); core.cancelPendingTreasury();

        // Cannot apply after cancel
        vm.warp(block.timestamp + 3 days);
        vm.expectRevert(NoPendingChange.selector);
        core.applyTreasury();
    }

    // ─────────────────────────────────────────────────────────────
    // Section 10 - Security: access control
    // ─────────────────────────────────────────────────────────────

    function test_fork_sec_attestCI_onlyRelayer() public {
        uint256 id = _postCode(AMT, 1, true);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);

        vm.prank(attacker);
        vm.expectRevert(NotRelayer.selector);
        core.attestCI(id, worker, true);
    }

    function test_fork_sec_pickWinner_onlyPoster() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);

        vm.prank(attacker);
        vm.expectRevert(NotPoster.selector);
        core.pickWinner(id, worker);
    }

    function test_fork_sec_allowToken_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.allowToken(IERC20(makeAddr("newToken")), 1e18);
    }

    function test_fork_sec_upgradeToAndCall_onlyOwner() public {
        // Call upgradeToAndCall on the proxy as a non-owner.
        // Low-level call captures the revert; check ok=false.
        address fakeImpl = makeAddr("fakeImpl");
        vm.prank(attacker);
        (bool ok,) = address(core).call(
            abi.encodeWithSignature("upgradeToAndCall(address,bytes)", fakeImpl, "")
        );
        assertFalse(ok); // revert → ok is false; no funds moved
    }

    function test_fork_sec_rescueBlockedForEscrowToken() public {
        vm.prank(owner);
        vm.expectRevert(CannotRescueEscrowToken.selector);
        core.rescueERC20(IERC20(address(cUSD)), attacker, 1e18);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 11 - Security: double-spend / replay attacks
    // ─────────────────────────────────────────────────────────────

    function test_fork_sec_doubleClaimReverts() public {
        uint256 id = _postCode(AMT, 3, false);
        _claim(id, worker);

        vm.prank(worker);
        vm.expectRevert(AlreadyClaimed.selector);
        core.claimSlot(id);
    }

    function test_fork_sec_doubleSubmitReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);

        vm.prank(worker);
        vm.expectRevert(AlreadySubmitted.selector);
        core.submitDeliverable(id, GIST, DHASH, "");
    }

    function test_fork_sec_doubleSettleReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster); core.pickWinner(id, worker);

        core.settleStake(id, worker);

        vm.expectRevert(StakeAlreadySettled.selector);
        core.settleStake(id, worker);
    }

    function test_fork_sec_doubleWithdrawReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster); core.pickWinner(id, worker);

        vm.prank(worker); core.withdrawEarnings(IERC20(address(cUSD)));
        vm.prank(worker);
        vm.expectRevert(NothingToWithdraw.selector);
        core.withdrawEarnings(IERC20(address(cUSD)));
    }

    // ─────────────────────────────────────────────────────────────
    // Section 12 - Security: timing attacks
    // ─────────────────────────────────────────────────────────────

    function test_fork_sec_submitAfterDeadlineReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        vm.warp(block.timestamp + 2 days); // past 1-day deadline
        vm.prank(worker);
        vm.expectRevert(DeadlinePassed.selector);
        core.submitDeliverable(id, GIST, DHASH, "");
    }

    function test_fork_sec_claimAfterDeadlineReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        vm.warp(block.timestamp + 2 days);
        vm.prank(worker);
        vm.expectRevert(DeadlinePassed.selector);
        core.claimSlot(id);
    }

    function test_fork_sec_cancelBeforeGracePeriodReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        vm.warp(block.timestamp + 1 days); // deadline passed
        vm.expectRevert(GracePeriodActive.selector);
        core.cancelExpired(id);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 13 - Security: slot saturation
    // ─────────────────────────────────────────────────────────────

    function test_fork_sec_slotsFullReverts() public {
        uint256 id = _postCode(AMT, 2, false); // maxSlots = 2
        _claim(id, worker);
        _claim(id, worker2);

        cUSD.mint(worker3, 10e18);
        vm.prank(worker3); cUSD.approve(address(core), type(uint256).max);
        _registerIdentity(worker3);

        vm.prank(worker3);
        vm.expectRevert(SlotsFull.selector);
        core.claimSlot(id);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 14 - Security: no-identity gate
    // ─────────────────────────────────────────────────────────────

    function test_fork_sec_noIdentityReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        cUSD.mint(attacker, 10e18);
        vm.prank(attacker); cUSD.approve(address(core), type(uint256).max);
        // attacker has no ERC-8004 NFT
        vm.prank(attacker);
        vm.expectRevert(NoAgentIdentity.selector);
        core.claimSlot(id);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 15 - Security: pause blocks key flows
    // ─────────────────────────────────────────────────────────────

    function test_fork_sec_pauseBlocksPost() public {
        vm.prank(owner); core.pause();
        vm.prank(poster);
        vm.expectRevert();
        core.postBounty(IERC20(address(cUSD)), 0, REPO, ISSUE, RHASH, AMT, 1, STAKE, DL, false);
        vm.prank(owner); core.unpause();
    }

    function test_fork_sec_pauseBlocksClaim() public {
        uint256 id = _postCode(AMT, 1, false);
        vm.prank(owner); core.pause();
        vm.prank(worker);
        vm.expectRevert();
        core.claimSlot(id);
        vm.prank(owner); core.unpause();
    }

    function test_fork_sec_pauseBlocksSubmit() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        vm.prank(owner); core.pause();
        vm.prank(worker);
        vm.expectRevert();
        core.submitDeliverable(id, GIST, DHASH, "");
        vm.prank(owner); core.unpause();
    }

    // ─────────────────────────────────────────────────────────────
    // Section 16 - Security: winner must have submitted + CI passed
    // ─────────────────────────────────────────────────────────────

    function test_fork_sec_pickNonClaimerAsWinnerReverts() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster);
        vm.expectRevert(WinnerInvalid.selector);
        core.pickWinner(id, worker2); // worker2 never claimed
    }

    function test_fork_sec_pickWinnerCIRequiredButNotAttested() public {
        uint256 id = _postCode(AMT, 1, true); // ciRequired = true
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        // No attestCI call
        vm.prank(poster);
        vm.expectRevert(WinnerInvalid.selector);
        core.pickWinner(id, worker);
    }

    function test_fork_sec_pickWinnerCIFailed() public {
        uint256 id = _postCode(AMT, 1, true);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(relayer); core.attestCI(id, worker, false); // CI failed
        vm.prank(poster);
        vm.expectRevert(WinnerInvalid.selector);
        core.pickWinner(id, worker);
    }

    // ─────────────────────────────────────────────────────────────
    // Section 17 - Fee accounting correctness
    // ─────────────────────────────────────────────────────────────

    function test_fork_feeAccounting_exact() public {
        uint256 id = _postCode(AMT, 1, false);
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);

        (uint96 expectedFee, uint96 expectedPayout) = EscrowLib.calcFeeAndPayout(AMT);

        // Capture AFTER claim - stake already deducted from worker
        uint256 workerAfterClaim = cUSD.balanceOf(worker);

        (,uint256 revBefore,,,) = core.getStats(address(cUSD));

        vm.prank(poster); core.pickWinner(id, worker);
        core.settleStake(id, worker); // stake refunded to winner

        vm.prank(worker); core.withdrawEarnings(IERC20(address(cUSD)));

        (,uint256 revAfter,,,) = core.getStats(address(cUSD));

        // Worker: payout credited + stake refunded; base is post-claim balance
        assertEq(cUSD.balanceOf(worker), workerAfterClaim + expectedPayout + STAKE);
        // Protocol revenue delta = fee
        assertEq(revAfter - revBefore, uint256(expectedFee));
    }

    // ─────────────────────────────────────────────────────────────
    // Section 18 - Getters and views
    // ─────────────────────────────────────────────────────────────

    function test_fork_getEligibleSubmissions() public {
        uint256 id = _postCode(AMT, 3, true);
        _claim(id, worker);
        _claim(id, worker2);
        _claim(id, worker3);

        _submit(id, worker,  GIST, DHASH);
        _submit(id, worker2, "https://gist.github.com/w2/b", keccak256("b"));
        // worker3 claims but doesn't submit

        vm.prank(relayer); core.attestCI(id, worker, true);
        vm.prank(relayer); core.attestCI(id, worker2, false); // CI fail

        address[] memory eligible = core.getEligibleSubmissions(id);
        assertEq(eligible.length, 1);
        assertEq(eligible[0], worker); // only worker1 passes CI
    }

    // ─────────────────────────────────────────────────────────────
    // Section: v3.1 attestReputation against the LIVE reputation registry
    // ─────────────────────────────────────────────────────────────

    IRepRegistry internal repRegistry = IRepRegistry(0x8004B663056A597Dffe9eCcC1965A193B7388713);

    function test_fork_upgradeToV31_attestReputation() public {
        // Upgrade the live Sepolia proxy in-fork to this build
        ClaudelanceCoreV3 newImpl = new ClaudelanceCoreV3();
        vm.prank(owner);
        core.upgradeToAndCall(address(newImpl), "");
        assertEq(core.version(), "3.1.0");

        // Fresh identity for the worker so we know its agentId
        vm.prank(worker);
        uint256 agentId = identity.register();

        // Direct-hire lifecycle (research type: no CI), then attest
        vm.prank(poster);
        uint256 id = core.postDirectHire(
            IERC20(address(cUSD)), worker,
            TaskTypeLib.TYPE_RESEARCH,
            REPO, ISSUE, RHASH, AMT, STAKE, DL
        );
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);
        vm.prank(poster);
        core.pickWinner(id, worker);

        vm.prank(attacker); // permissionless
        core.attestReputation(id, agentId);
        assertTrue(core.isReputationAttested(id));

        // The REAL registry recorded the core proxy as client with +1
        address[] memory clients = repRegistry.getClients(agentId);
        assertEq(clients.length, 1);
        assertEq(clients[0], address(core));
        (uint64 count, int128 score, uint8 decimals_) = repRegistry.getSummary(agentId, clients, "", "");
        assertEq(count, 1);
        assertEq(score, 1);
        assertEq(decimals_, 0);

        // Tag filter works: feedback was tagged claudelance/<type>
        (uint64 tagCount,,) = repRegistry.getSummary(agentId, clients, "claudelance", "2");
        assertEq(tagCount, 1);

        // Guards on the live path
        vm.expectRevert(AlreadyAttested.selector);
        core.attestReputation(id, agentId);
    }

    function test_fork_attestReputation_guards() public {
        ClaudelanceCoreV3 newImpl = new ClaudelanceCoreV3();
        vm.prank(owner);
        core.upgradeToAndCall(address(newImpl), "");

        vm.prank(worker);
        uint256 workerAgent = identity.register();
        vm.prank(worker2);
        uint256 otherAgent = identity.register();

        vm.prank(poster);
        uint256 id = core.postDirectHire(
            IERC20(address(cUSD)), worker,
            TaskTypeLib.TYPE_RESEARCH,
            REPO, ISSUE, RHASH, AMT, STAKE, DL
        );
        _claim(id, worker);
        _submit(id, worker, GIST, DHASH);

        // Not resolved yet
        vm.expectRevert(BountyNotResolved.selector);
        core.attestReputation(id, workerAgent);

        vm.prank(poster);
        core.pickWinner(id, worker);

        // agentId not owned by the winner
        vm.expectRevert(AgentNotWinner.selector);
        core.attestReputation(id, otherAgent);
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    function _postCode(uint96 amount, uint8 maxSlots, bool ci) internal returns (uint256) {
        vm.prank(poster);
        return core.postBounty(
            IERC20(address(cUSD)), TaskTypeLib.TYPE_CODE,
            REPO, ISSUE, RHASH, amount, maxSlots, STAKE, DL, ci
        );
    }

    function _claim(uint256 id, address w) internal {
        vm.prank(w);
        core.claimSlot(id);
    }

    function _submit(uint256 id, address w, string memory url, bytes32 hash) internal {
        vm.prank(w);
        core.submitDeliverable(id, url, hash, "");
    }

    function _registerIdentity(address addr) internal {
        if (identity.balanceOf(addr) == 0) {
            vm.prank(addr);
            identity.register();
        }
    }

    function _treasuryEarnings() internal view returns (uint256) {
        // Read treasury earnings from storage via proxy
        // earnings[treasury][cUSD] is in EIP-7201 namespaced storage,
        // so we read it via a withdrawEarnings dry-run (staticcall)
        return 0; // placeholder - actual balance tracked via getStats revenue
    }
}
