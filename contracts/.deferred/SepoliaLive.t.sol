// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { stdJson } from "forge-std/StdJson.sol";

import { ClaudelanceCore } from "../../src/ClaudelanceCore.sol";
import { IClaudelanceCore } from "../../src/interfaces/IClaudelanceCore.sol";
import { MockCUSD } from "../../src/mocks/MockCUSD.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title  SepoliaLiveTest
/// @notice Integration suite that forks Celo Sepolia and exercises the live
///         ClaudelanceCore deployment recorded in `deployments/celo-sepolia.json`.
///         Skips automatically when `CELO_SEPOLIA_RPC` is unset, so the default
///         `forge test` run on a developer machine stays cheap.
///
/// Run only this suite:
///   forge test --match-path "test/integration/SepoliaLive.t.sol" -vvv
///
/// These tests do NOT broadcast - Foundry creates a local fork and the deployed
/// bytecode is exercised in memory. State pollution on the actual chain comes
/// only from the broadcast scripts (`SeedBounties`, `IntegrationE2E`).
contract SepoliaLiveTest is Test {
    using stdJson for string;

    ClaudelanceCore internal core;
    MockCUSD internal cusd;
    address internal coreAddr;
    address internal cusdAddr;
    address internal liveOwner;
    address internal liveTreasury;
    address internal liveRelayer;

    address internal poster = makeAddr("fork-poster");
    address internal w1 = makeAddr("fork-w1");
    address internal w2 = makeAddr("fork-w2");
    address internal stranger = makeAddr("fork-stranger");

    uint96 internal constant AMOUNT = 5e18;
    uint96 internal constant STAKE = 0.25e18;
    uint8 internal constant SLOTS = 5;
    uint64 internal constant DEADLINE = 2 days;

    function setUp() public {
        string memory rpc = vm.envOr("CELO_SEPOLIA_RPC", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }

        vm.createSelectFork(rpc);

        string memory deployJson = vm.readFile("./deployments/celo-sepolia.json");
        coreAddr = deployJson.readAddress(".core");
        cusdAddr = deployJson.readAddress(".cUSD");

        core = ClaudelanceCore(coreAddr);
        cusd = MockCUSD(cusdAddr);

        liveOwner = core.owner();
        liveTreasury = core.treasury();
        liveRelayer = core.ciRelayer();

        // MockCUSD has permissionless mint - give every fork actor enough headroom
        // to post bounties, claim stakes, and absorb fees.
        cusd.mint(poster, 1_000e18);
        cusd.mint(w1, 100e18);
        cusd.mint(w2, 100e18);

        vm.prank(poster);
        cusd.approve(coreAddr, type(uint256).max);
        vm.prank(w1);
        cusd.approve(coreAddr, type(uint256).max);
        vm.prank(w2);
        cusd.approve(coreAddr, type(uint256).max);
    }

    function _post() internal returns (uint256) {
        vm.prank(poster);
        return core.postBounty(
            0,
            "github.com/yeheskieltame/claudelance-sandbox",
            "github.com/yeheskieltame/claudelance-sandbox/issues/integration",
            keccak256("fork-test"),
            AMOUNT,
            SLOTS,
            STAKE,
            DEADLINE,
            true
        );
    }

    function _claim(uint256 id, address w) internal {
        vm.prank(w);
        core.claimSlot(id);
    }

    function _submit(uint256 id, address w, string memory pr) internal {
        vm.prank(w);
        core.submitPR(id, pr, keccak256(abi.encodePacked(pr)), "");
    }

    function _attest(uint256 id, address w, bool ok) internal {
        vm.prank(liveRelayer);
        core.attestCI(id, w, ok);
    }

    function test_Live_ConstantsMatchSource() public view {
        assertEq(core.PROTOCOL_FEE_BPS(), 200);
        assertEq(core.BPS_DENOMINATOR(), 10_000);
        assertEq(core.MAX_SLOTS(), 20);
        assertEq(core.MIN_DEADLINE(), 1 days);
        assertEq(core.MAX_DEADLINE(), 14 days);
        assertEq(core.MIN_BOUNTY(), 0.5e18);
        assertEq(core.RESOLUTION_GRACE_PERIOD(), 3 days);
    }

    function test_Live_RolesMatchDeployment() public view {
        string memory deployJson = vm.readFile("./deployments/celo-sepolia.json");
        assertEq(liveOwner, deployJson.readAddress(".owner"));
        assertEq(liveTreasury, deployJson.readAddress(".treasury"));
        assertEq(liveRelayer, deployJson.readAddress(".ciRelayer"));
        assertEq(address(core.cUSD()), cusdAddr);
    }

    function test_Live_cUSDIsMockMintAndSymbolMatch() public view {
        assertEq(cusd.symbol(), "cUSD");
        assertEq(cusd.decimals(), 18);
        assertGe(cusd.balanceOf(poster), 1_000e18);
    }

    function test_Live_FullLifecycle_ResolvesAndCreditsAtomically() public {
        uint256 startVolume = core.totalBountyVolume();
        uint256 startResolved = core.totalBountiesResolved();
        uint256 startRevenue = core.totalProtocolRevenue();
        uint256 treasuryEarningsBefore = core.earnings(liveTreasury);

        uint256 id = _post();

        _claim(id, w1);
        _claim(id, w2);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/A");
        _submit(id, w2, "github.com/yeheskieltame/claudelance-sandbox/pull/B");
        _attest(id, w1, true);
        _attest(id, w2, true);

        vm.prank(poster);
        core.pickWinner(id, w1);

        uint96 expectedFee = uint96((uint256(AMOUNT) * 200) / 10_000);
        uint96 expectedPayout = AMOUNT - expectedFee;

        // Stakes settled separately (pull pattern).
        core.settleStake(id, w1);
        core.settleStake(id, w2);

        assertEq(core.earnings(w1), uint256(expectedPayout) + STAKE, "winner: payout + stake refund");
        assertEq(core.earnings(w2), STAKE, "good-faith loser: stake refund only");
        assertEq(
            core.earnings(liveTreasury),
            treasuryEarningsBefore + expectedFee,
            "treasury fee credited via earnings (pull pattern)"
        );
        assertEq(core.totalBountyVolume(), startVolume + AMOUNT, "volume += AMOUNT");
        assertEq(core.totalBountiesResolved(), startResolved + 1, "resolved counter +1");
        assertEq(core.totalProtocolRevenue(), startRevenue + expectedFee, "revenue += fee");

        uint256 w1Balance = cusd.balanceOf(w1);
        vm.prank(w1);
        core.withdrawEarnings();
        assertEq(cusd.balanceOf(w1), w1Balance + uint256(expectedPayout) + STAKE);
        assertEq(core.earnings(w1), 0);
    }

    function test_Live_GracePeriodBlocksThirdPartyCancel() public {
        uint256 id = _post();
        _claim(id, w1);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/C");
        _attest(id, w1, true);

        vm.warp(block.timestamp + DEADLINE + 1);

        vm.expectRevert(ClaudelanceCore.GracePeriodActive.selector);
        vm.prank(stranger);
        core.cancelExpired(id);

        IClaudelanceCore.Bounty memory b = core.getBounty(id);
        assertEq(uint8(b.status), uint8(IClaudelanceCore.BountyStatus.Open));
    }

    function test_Live_AfterGrace_PublicCancelSettlesGoodFaith() public {
        uint256 id = _post();
        _claim(id, w1);
        _claim(id, w2);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/D");
        _attest(id, w1, true);

        uint256 posterEarningsBefore = core.earnings(poster);
        uint256 treasuryEarningsBefore = core.earnings(liveTreasury);

        vm.warp(block.timestamp + DEADLINE + core.RESOLUTION_GRACE_PERIOD() + 1);
        vm.prank(stranger);
        core.cancelExpired(id);

        // Stakes are now settled via the permissionless `settleStake` pull pattern.
        core.settleStake(id, w1);
        core.settleStake(id, w2);

        assertEq(core.earnings(poster), posterEarningsBefore + AMOUNT, "poster refund credited via earnings");
        assertEq(core.earnings(w1), STAKE, "passing-CI loser keeps stake");
        assertEq(core.earnings(w2), 0, "no-submission worker forfeits");
        assertEq(
            core.earnings(liveTreasury),
            treasuryEarningsBefore + STAKE,
            "treasury credited forfeited stake via earnings"
        );
    }

    function test_Live_SubmitPRIsOneShot() public {
        uint256 id = _post();
        _claim(id, w1);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/E");

        vm.expectRevert(ClaudelanceCore.AlreadySubmitted.selector);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/E-malicious");
    }

    function test_Live_StatsViewMatchesAccumulators() public view {
        (uint256 vol, uint256 rev, uint256 res, uint256 posters, uint256 workers) = core.getStats();
        assertEq(vol, core.totalBountyVolume());
        assertEq(rev, core.totalProtocolRevenue());
        assertEq(res, core.totalBountiesResolved());
        assertEq(posters, core.uniquePosterCount());
        assertEq(workers, core.uniqueWorkerCount());
    }

    // -----------------------------------------------------------------------
    //                       Revert-path coverage
    // -----------------------------------------------------------------------

    function test_Live_PostBounty_RejectsInvalidParams() public {
        vm.startPrank(poster);

        vm.expectRevert(ClaudelanceCore.InvalidAmount.selector);
        core.postBounty(0, "x", "x", bytes32(0), 0.1e18, SLOTS, STAKE, DEADLINE, true);

        vm.expectRevert(ClaudelanceCore.InvalidSlots.selector);
        core.postBounty(0, "x", "x", bytes32(0), AMOUNT, 0, STAKE, DEADLINE, true);

        vm.expectRevert(ClaudelanceCore.InvalidSlots.selector);
        core.postBounty(0, "x", "x", bytes32(0), AMOUNT, 21, STAKE, DEADLINE, true);

        vm.expectRevert(ClaudelanceCore.InvalidDeadline.selector);
        core.postBounty(0, "x", "x", bytes32(0), AMOUNT, SLOTS, STAKE, 1 hours, true);

        vm.expectRevert(ClaudelanceCore.InvalidDeadline.selector);
        core.postBounty(0, "x", "x", bytes32(0), AMOUNT, SLOTS, STAKE, 30 days, true);

        vm.expectRevert(ClaudelanceCore.InvalidUrl.selector);
        core.postBounty(0, "", "x", bytes32(0), AMOUNT, SLOTS, STAKE, DEADLINE, true);

        vm.expectRevert(ClaudelanceCore.InvalidUrl.selector);
        core.postBounty(0, "x", "", bytes32(0), AMOUNT, SLOTS, STAKE, DEADLINE, true);

        vm.stopPrank();
    }

    function test_Live_ClaimSlot_RejectsDoubleClaimSlotsFullDeadline() public {
        uint256 id = _post();

        _claim(id, w1);

        vm.expectRevert(ClaudelanceCore.AlreadyClaimed.selector);
        vm.prank(w1);
        core.claimSlot(id);

        address[5] memory extra = [
            makeAddr("fork-extra-1"),
            makeAddr("fork-extra-2"),
            makeAddr("fork-extra-3"),
            makeAddr("fork-extra-4"),
            makeAddr("fork-extra-5")
        ];
        for (uint256 i = 0; i < extra.length; i++) {
            cusd.mint(extra[i], STAKE);
            vm.prank(extra[i]);
            cusd.approve(coreAddr, STAKE);
            if (i + 1 + 1 <= SLOTS) {
                // SLOTS = 5, slot 1 already taken by w1; fill 2..5
                vm.prank(extra[i]);
                core.claimSlot(id);
            } else {
                vm.expectRevert(ClaudelanceCore.SlotsFull.selector);
                vm.prank(extra[i]);
                core.claimSlot(id);
            }
        }

        vm.warp(block.timestamp + DEADLINE + 1);
        address late = makeAddr("fork-late");
        cusd.mint(late, STAKE);
        vm.prank(late);
        cusd.approve(coreAddr, STAKE);
        vm.expectRevert(ClaudelanceCore.DeadlinePassed.selector);
        vm.prank(late);
        core.claimSlot(id);
    }

    function test_Live_SubmitPR_RejectsBadInputAndState() public {
        uint256 id = _post();

        // Non-claimer cannot submit.
        vm.expectRevert(ClaudelanceCore.NotClaimer.selector);
        vm.prank(stranger);
        core.submitPR(id, "github.com/whatever/pull/1", bytes32(uint256(1)), "");

        _claim(id, w1);

        // Empty PR URL rejected.
        vm.expectRevert(ClaudelanceCore.NoSubmission.selector);
        vm.prank(w1);
        core.submitPR(id, "", bytes32(uint256(1)), "");

        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/V1");

        // After deadline, even a fresh claimer cannot submit.
        vm.warp(block.timestamp + DEADLINE + 1);
        vm.expectRevert(ClaudelanceCore.DeadlinePassed.selector);
        vm.prank(w2);
        core.submitPR(id, "github.com/whatever/pull/2", bytes32(uint256(2)), "");
    }

    function test_Live_AttestCI_RejectsBadCallerAndState() public {
        uint256 id = _post();

        // Non-relayer reverts.
        vm.expectRevert(ClaudelanceCore.NotRelayer.selector);
        vm.prank(stranger);
        core.attestCI(id, w1, true);

        // Live relayer attesting a non-claimer reverts.
        vm.expectRevert(ClaudelanceCore.NotClaimer.selector);
        vm.prank(liveRelayer);
        core.attestCI(id, w1, true);

        _claim(id, w1);

        // Relayer attesting before submission reverts.
        vm.expectRevert(ClaudelanceCore.NoSubmission.selector);
        vm.prank(liveRelayer);
        core.attestCI(id, w1, true);
    }

    function test_Live_AttestCI_AllowsToggleByRelayer() public {
        uint256 id = _post();
        _claim(id, w1);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/T1");

        _attest(id, w1, true);
        assertTrue(core.getSubmission(id, w1).ciPassed);

        _attest(id, w1, false);
        assertFalse(core.getSubmission(id, w1).ciPassed);

        _attest(id, w1, true);
        assertTrue(core.getSubmission(id, w1).ciPassed);
    }

    function test_Live_PickWinner_RevertPaths() public {
        uint256 id = _post();
        _claim(id, w1);

        // Non-poster reverts.
        vm.expectRevert(ClaudelanceCore.NotPoster.selector);
        vm.prank(stranger);
        core.pickWinner(id, w1);

        // Winner not a claimer.
        vm.expectRevert(ClaudelanceCore.WinnerInvalid.selector);
        vm.prank(poster);
        core.pickWinner(id, stranger);

        // Winner is a claimer but has no submission.
        vm.expectRevert(ClaudelanceCore.WinnerInvalid.selector);
        vm.prank(poster);
        core.pickWinner(id, w1);

        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/PW1");

        // ciRequired = true but no attestation yet.
        vm.expectRevert(ClaudelanceCore.WinnerInvalid.selector);
        vm.prank(poster);
        core.pickWinner(id, w1);

        _attest(id, w1, true);

        // Happy path closes the bounty.
        vm.prank(poster);
        core.pickWinner(id, w1);

        // Already resolved.
        vm.expectRevert(ClaudelanceCore.BountyNotOpen.selector);
        vm.prank(poster);
        core.pickWinner(id, w1);
    }

    function test_Live_PickWinner_NoCIRequired_WorksWithoutAttestation() public {
        vm.prank(poster);
        uint256 id = core.postBounty(
            0,
            "github.com/yeheskieltame/claudelance-sandbox",
            "github.com/yeheskieltame/claudelance-sandbox/issues/no-ci",
            keccak256("no-ci"),
            AMOUNT,
            1,
            0,
            DEADLINE,
            false
        );

        _claim(id, w1);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/NOCI");

        // No attestCI call - should still resolve because ciRequired = false.
        vm.prank(poster);
        core.pickWinner(id, w1);

        IClaudelanceCore.Bounty memory b = core.getBounty(id);
        assertEq(uint8(b.status), uint8(IClaudelanceCore.BountyStatus.Resolved));
        assertEq(b.winner, w1);
    }

    function test_Live_CancelExpired_RevertPaths() public {
        uint256 id = _post();

        // Pre-deadline cancel reverts even from poster.
        vm.expectRevert(ClaudelanceCore.BountyNotExpired.selector);
        vm.prank(poster);
        core.cancelExpired(id);

        // Resolve the bounty fully first.
        _claim(id, w1);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/CE1");
        _attest(id, w1, true);
        vm.prank(poster);
        core.pickWinner(id, w1);

        // Cancel-after-resolve reverts.
        vm.warp(block.timestamp + DEADLINE + core.RESOLUTION_GRACE_PERIOD() + 1);
        vm.expectRevert(ClaudelanceCore.BountyNotOpen.selector);
        vm.prank(stranger);
        core.cancelExpired(id);
    }

    function test_Live_WithdrawEarnings_RevertsOnEmptyBalance() public {
        // Caller has never had earnings credited.
        address freshActor = makeAddr("fork-fresh-earner");
        vm.expectRevert(ClaudelanceCore.NothingToWithdraw.selector);
        vm.prank(freshActor);
        core.withdrawEarnings();
    }

    function test_Live_WithdrawEarnings_ClearsBalanceAndPays() public {
        uint256 id = _post();
        _claim(id, w1);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/W1");
        _attest(id, w1, true);
        vm.prank(poster);
        core.pickWinner(id, w1);

        uint256 owed = core.earnings(w1);
        assertGt(owed, 0, "winner should have earnings to withdraw");

        uint256 before = cusd.balanceOf(w1);
        vm.prank(w1);
        core.withdrawEarnings();

        assertEq(core.earnings(w1), 0, "earnings cleared");
        assertEq(cusd.balanceOf(w1), before + owed, "exact payout transferred");

        vm.expectRevert(ClaudelanceCore.NothingToWithdraw.selector);
        vm.prank(w1);
        core.withdrawEarnings();
    }

    // -----------------------------------------------------------------------
    //                       Admin + pause + rescue
    // -----------------------------------------------------------------------

    function test_Live_AdminTimelock_OnlyOwnerAndApplyAfterDelay() public {
        address newT = makeAddr("fork-treasury-2");
        address newR = makeAddr("fork-relayer-2");

        // Non-owner cannot propose.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        core.proposeTreasury(newT);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        core.proposeCIRelayer(newR);

        // Zero / self rejected even from owner.
        vm.startPrank(liveOwner);
        vm.expectRevert(ClaudelanceCore.InvalidAddress.selector);
        core.proposeTreasury(address(0));
        vm.expectRevert(ClaudelanceCore.InvalidAddress.selector);
        core.proposeTreasury(address(core));
        vm.expectRevert(ClaudelanceCore.InvalidAddress.selector);
        core.proposeCIRelayer(address(0));
        vm.stopPrank();

        // Apply before propose reverts.
        vm.expectRevert(ClaudelanceCore.NoPendingChange.selector);
        core.applyTreasury();

        // Happy path: propose -> wait -> apply.
        uint64 expectedEffective = uint64(block.timestamp + core.ADMIN_TIMELOCK());
        vm.expectEmit(true, false, false, true);
        emit IClaudelanceCore.TreasuryProposed(newT, expectedEffective);
        vm.prank(liveOwner);
        core.proposeTreasury(newT);
        assertEq(core.treasury(), liveTreasury, "treasury unchanged before apply");

        vm.expectRevert(ClaudelanceCore.TimelockNotElapsed.selector);
        core.applyTreasury();

        vm.warp(block.timestamp + core.ADMIN_TIMELOCK());
        vm.expectEmit(true, true, false, false);
        emit IClaudelanceCore.TreasuryUpdated(liveTreasury, newT);
        core.applyTreasury();
        assertEq(core.treasury(), newT);

        // Same flow for relayer.
        vm.prank(liveOwner);
        core.proposeCIRelayer(newR);
        vm.warp(block.timestamp + core.ADMIN_TIMELOCK());
        core.applyCIRelayer();
        assertEq(core.ciRelayer(), newR);
    }

    function test_Live_Pause_BlocksWritesButAllowsResolution() public {
        // Seed an in-flight bounty before pausing.
        uint256 id = _post();
        _claim(id, w1);
        _submit(id, w1, "github.com/yeheskieltame/claudelance-sandbox/pull/PAUSE");
        _attest(id, w1, true);

        vm.prank(liveOwner);
        core.pause();

        // postBounty blocked.
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(poster);
        core.postBounty(
            0, "github.com/x/y", "github.com/x/y/issues/1", bytes32(0),
            AMOUNT, SLOTS, STAKE, DEADLINE, true
        );

        // claimSlot blocked.
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(w2);
        core.claimSlot(id);

        // submitPR blocked (w2 is not a claimer but pause is checked first
        // by whenNotPaused; using w1 - already submitted, but submitPR also
        // has the whenNotPaused modifier and would revert there).
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(w1);
        core.submitPR(id, "github.com/x/y/pull/late", bytes32(0), "");

        // pickWinner still works while paused (intentional - lets in-flight
        // bounties resolve).
        vm.prank(poster);
        core.pickWinner(id, w1);
        IClaudelanceCore.Bounty memory b = core.getBounty(id);
        assertEq(uint8(b.status), uint8(IClaudelanceCore.BountyStatus.Resolved));

        // withdrawEarnings still works while paused.
        vm.prank(w1);
        core.withdrawEarnings();

        // Unpause restores postBounty.
        vm.prank(liveOwner);
        core.unpause();
        vm.prank(poster);
        core.postBounty(
            0, "github.com/x/y", "github.com/x/y/issues/2", bytes32(0),
            AMOUNT, SLOTS, STAKE, DEADLINE, true
        );
    }

    function test_Live_Pause_OnlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        core.pause();

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        core.unpause();
    }

    // -----------------------------------------------------------------------
    //                       Stats + view-fn correctness
    // -----------------------------------------------------------------------

    function test_Live_MultiPoster_UniquePosterCountIncrements() public {
        address poster2 = makeAddr("fork-poster-2");
        cusd.mint(poster2, 100e18);
        vm.prank(poster2);
        cusd.approve(coreAddr, type(uint256).max);

        uint256 startUniqueP = core.uniquePosterCount();

        _post();
        // poster's first post on this fork: count goes up by 1 (or 0 if poster
        // already posted live, which doesn't apply because each fork test
        // forks fresh state).
        uint256 afterFirst = core.uniquePosterCount();

        vm.prank(poster2);
        core.postBounty(
            0, "github.com/x/y", "github.com/x/y/issues/p2", bytes32("p2"),
            AMOUNT, SLOTS, STAKE, DEADLINE, true
        );
        uint256 afterSecond = core.uniquePosterCount();

        assertGe(afterFirst, startUniqueP, "poster posted (live state may already include poster)");
        assertEq(afterSecond - afterFirst, 1, "poster2 is a brand-new poster");
    }

    function test_Live_BountyType_CounterPerType() public {
        uint256 typeFiveBefore = core.bountyCountByType(5);

        vm.prank(poster);
        core.postBounty(
            5, "github.com/x/y", "github.com/x/y/issues/type5", bytes32("t5"),
            AMOUNT, 1, 0, DEADLINE, false
        );
        vm.prank(poster);
        core.postBounty(
            5, "github.com/x/y", "github.com/x/y/issues/type5b", bytes32("t5b"),
            AMOUNT, 1, 0, DEADLINE, false
        );

        assertEq(core.bountyCountByType(5) - typeFiveBefore, 2);
        assertEq(core.bountyCountByType(99), 0);
    }

    function test_Live_GetEligibleSubmissions_FiltersCorrectly() public {
        uint256 id = _post();
        _claim(id, w1);
        _claim(id, w2);
        address w3 = makeAddr("fork-w3");
        cusd.mint(w3, 10e18);
        vm.prank(w3);
        cusd.approve(coreAddr, type(uint256).max);
        _claim(id, w3);

        // Only w1 submits and passes CI; w2 submits but fails CI; w3 never submits.
        _submit(id, w1, "github.com/.../pull/E1");
        _submit(id, w2, "github.com/.../pull/E2");
        _attest(id, w1, true);
        _attest(id, w2, false);

        address[] memory eligible = core.getEligibleSubmissions(id);
        assertEq(eligible.length, 1, "only w1 is CI-passing");
        assertEq(eligible[0], w1);

        // Now relayer changes mind and approves w2.
        _attest(id, w2, true);
        address[] memory eligibleAfter = core.getEligibleSubmissions(id);
        assertEq(eligibleAfter.length, 2);
    }

    function test_Live_GetEligibleSubmissions_NoCIRequired_IncludesAllSubmitted() public {
        vm.prank(poster);
        uint256 id = core.postBounty(
            0,
            "github.com/yeheskieltame/claudelance-sandbox",
            "github.com/yeheskieltame/claudelance-sandbox/issues/no-ci-list",
            keccak256("no-ci-list"),
            AMOUNT,
            3,
            0,
            DEADLINE,
            false
        );
        _claim(id, w1);
        _claim(id, w2);
        _submit(id, w1, "github.com/.../pull/N1");
        _submit(id, w2, "github.com/.../pull/N2");

        // No attestCI calls; ciRequired = false ⇒ both should be eligible.
        address[] memory eligible = core.getEligibleSubmissions(id);
        assertEq(eligible.length, 2);
    }

    function test_Live_GetClaimers_ReturnsExactOrder() public {
        uint256 id = _post();
        _claim(id, w1);
        _claim(id, w2);

        address[] memory claimers = core.getClaimers(id);
        assertEq(claimers.length, 2);
        assertEq(claimers[0], w1);
        assertEq(claimers[1], w2);
    }

    function test_Live_HasClaimed_PublicMapping() public {
        uint256 id = _post();
        assertFalse(core.hasClaimed(id, w1));
        _claim(id, w1);
        assertTrue(core.hasClaimed(id, w1));
        assertFalse(core.hasClaimed(id, w2));
    }

    function test_Live_RescueERC20_FullFlow() public {
        // Deploy a foreign ERC20 and mint some to the deployed core.
        MockCUSD foreign = new MockCUSD();
        foreign.mint(coreAddr, 42e18);
        address rescueTo = makeAddr("fork-rescue-recipient");

        // Non-owner blocked.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        core.rescueERC20(IERC20(address(foreign)), rescueTo, 1);

        // Zero recipient rejected.
        vm.prank(liveOwner);
        vm.expectRevert(ClaudelanceCore.InvalidAddress.selector);
        core.rescueERC20(IERC20(address(foreign)), address(0), 1);

        // Real cUSD rejected.
        vm.prank(liveOwner);
        vm.expectRevert(ClaudelanceCore.CannotRescueCUSD.selector);
        core.rescueERC20(IERC20(cusdAddr), rescueTo, 1);

        // Happy path: rescue forwards balance and emits.
        vm.expectEmit(true, true, false, true);
        emit IClaudelanceCore.ERC20Rescued(address(foreign), rescueTo, 42e18);
        vm.prank(liveOwner);
        core.rescueERC20(IERC20(address(foreign)), rescueTo, 42e18);

        assertEq(foreign.balanceOf(rescueTo), 42e18);
        assertEq(foreign.balanceOf(coreAddr), 0);
    }
}
