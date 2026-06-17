// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ClaudelanceCore } from "../src/ClaudelanceCore.sol";
import { IClaudelanceCore } from "../src/interfaces/IClaudelanceCore.sol";
import { MockCUSD } from "../src/mocks/MockCUSD.sol";

/// @title  IntegrationResolveBatch
/// @notice Resolves two of the seeded Sepolia bounties on chain to exercise
///         resolution paths the first E2E did not cover:
///           - Bounty A: relayer attests CI=false for one submitter → that
///             worker's stake is FORFEITED to treasury.
///           - Bounty B: poster picks W2 (not W1) → first time the alt winner
///             path runs live; W1 receives a good-faith stake refund.
///
///         Targets seeded bounty ids 1 and 2 (both 0.75 mock cUSD, 3 slots,
///         5% stake, 2-day deadline, ciRequired = true).
///
/// Required env:
///   CORE_ADDRESS, CUSD_ADDRESS, DEPLOYER_PRIVATE_KEY,
///   W1_PRIVATE_KEY, W2_PRIVATE_KEY
contract IntegrationResolveBatch is Script {
    string internal constant REPO = "github.com/yeheskieltame/claudelance-sandbox";

    function run() external {
        address coreAddr = vm.envAddress("CORE_ADDRESS");
        address cusdAddr = vm.envAddress("CUSD_ADDRESS");
        uint256 posterPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 w1Pk = vm.envUint("W1_PRIVATE_KEY");
        uint256 w2Pk = vm.envUint("W2_PRIVATE_KEY");

        ClaudelanceCore core = ClaudelanceCore(coreAddr);
        MockCUSD cusd = MockCUSD(cusdAddr);

        address w1 = vm.addr(w1Pk);
        address w2 = vm.addr(w2Pk);
        address treasury = core.treasury();

        uint256 resolvedStart = core.totalBountiesResolved();
        uint256 revenueStart = core.totalProtocolRevenue();
        uint256 treasuryCusdStart = cusd.balanceOf(treasury);

        // Both workers approve unlimited so they can claim across both bounties.
        vm.startBroadcast(w1Pk);
        cusd.approve(coreAddr, type(uint256).max);
        vm.stopBroadcast();

        vm.startBroadcast(w2Pk);
        cusd.approve(coreAddr, type(uint256).max);
        vm.stopBroadcast();

        // ====================================================================
        // Bounty A - bountyId 1 - forfeit-to-treasury path
        // ====================================================================
        uint256 idA = 1;
        IClaudelanceCore.Bounty memory bA = core.getBounty(idA);
        require(bA.status == IClaudelanceCore.BountyStatus.Open, "bountyA not open");
        require(block.timestamp < bA.deadline, "bountyA past deadline");
        console2.log("--- Resolving bounty A (forfeit path) ---");
        console2.log("id:        ", idA);
        console2.log("amount:    ", bA.amount);
        console2.log("stake:     ", bA.stakeRequired);

        vm.startBroadcast(w1Pk);
        core.claimSlot(idA);
        core.submitPR(idA, string.concat(REPO, "/pull/A-W1"), keccak256("A-W1"), "");
        vm.stopBroadcast();

        vm.startBroadcast(w2Pk);
        core.claimSlot(idA);
        core.submitPR(idA, string.concat(REPO, "/pull/A-W2"), keccak256("A-W2"), "");
        vm.stopBroadcast();

        // Relayer (same key as deployer / poster) attests w1=true, w2=false then picks w1.
        vm.startBroadcast(posterPk);
        core.attestCI(idA, w1, true);
        core.attestCI(idA, w2, false);
        core.pickWinner(idA, w1);
        vm.stopBroadcast();

        // ====================================================================
        // Bounty B - bountyId 2 - alt-winner path (W2 wins this time)
        // ====================================================================
        uint256 idB = 2;
        IClaudelanceCore.Bounty memory bB = core.getBounty(idB);
        require(bB.status == IClaudelanceCore.BountyStatus.Open, "bountyB not open");
        require(block.timestamp < bB.deadline, "bountyB past deadline");
        console2.log("--- Resolving bounty B (W2 wins) ---");
        console2.log("id:        ", idB);

        vm.startBroadcast(w1Pk);
        core.claimSlot(idB);
        core.submitPR(idB, string.concat(REPO, "/pull/B-W1"), keccak256("B-W1"), "");
        vm.stopBroadcast();

        vm.startBroadcast(w2Pk);
        core.claimSlot(idB);
        core.submitPR(idB, string.concat(REPO, "/pull/B-W2"), keccak256("B-W2"), "");
        vm.stopBroadcast();

        vm.startBroadcast(posterPk);
        core.attestCI(idB, w1, true);
        core.attestCI(idB, w2, true);
        core.pickWinner(idB, w2);
        vm.stopBroadcast();

        // ====================================================================
        // Post-state assertions
        // ====================================================================
        console2.log("--- Post-state ---");
        console2.log("totalBountiesResolved delta:", core.totalBountiesResolved() - resolvedStart);
        console2.log("totalProtocolRevenue delta: ", core.totalProtocolRevenue() - revenueStart);
        console2.log("treasury cUSD delta:        ", cusd.balanceOf(treasury) - treasuryCusdStart);
        console2.log("w1 earnings (good-faith from B):", core.earnings(w1));
        console2.log("w2 earnings (payout + stake from B):", core.earnings(w2));

        IClaudelanceCore.Bounty memory aFinal = core.getBounty(idA);
        IClaudelanceCore.Bounty memory bFinal = core.getBounty(idB);
        require(aFinal.status == IClaudelanceCore.BountyStatus.Resolved, "A not resolved");
        require(aFinal.winner == w1, "A winner mismatch");
        require(bFinal.status == IClaudelanceCore.BountyStatus.Resolved, "B not resolved");
        require(bFinal.winner == w2, "B winner mismatch");
        require(core.totalBountiesResolved() == resolvedStart + 2, "resolved counter mismatch");
    }
}
