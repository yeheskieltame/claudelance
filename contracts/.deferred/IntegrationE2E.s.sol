// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ClaudelanceCore } from "../src/ClaudelanceCore.sol";
import { IClaudelanceCore } from "../src/interfaces/IClaudelanceCore.sol";
import { MockCUSD } from "../src/mocks/MockCUSD.sol";

/// @title  IntegrationE2E
/// @notice Multi-actor end-to-end lifecycle that broadcasts a real bounty
///         resolution against the deployed core. Exercises every public
///         mutating function except cancelExpired and the admin setters,
///         and confirms the post-state on-chain.
///
/// Required env:
///   CORE_ADDRESS         - deployed ClaudelanceCore
///   CUSD_ADDRESS         - deployed MockCUSD (Sepolia stand-in)
///   DEPLOYER_PRIVATE_KEY - poster + relayer + treasury + owner
///   W1_PRIVATE_KEY       - winning worker
///   W2_PRIVATE_KEY       - losing-but-passing-CI worker (good-faith refund)
///
/// Sequence on chain (10 transactions):
///   1.  Poster approves cUSD spend for AMOUNT
///   2.  Poster postBounty(2 slots, stake required, CI required)
///   3.  W1 approves cUSD spend for STAKE
///   4.  W1 claimSlot
///   5.  W2 approves cUSD spend for STAKE
///   6.  W2 claimSlot
///   7.  W1 submitPR
///   8.  W2 submitPR
///   9.  Relayer attestCI(W1, true)
///   10. Relayer attestCI(W2, true)
///   11. Poster pickWinner(W1)
///   12. W1 withdrawEarnings
contract IntegrationE2E is Script {
    uint96 internal constant AMOUNT = 1e18;
    uint96 internal constant STAKE = 0.05e18;
    uint8 internal constant SLOTS = 2;
    uint64 internal constant DEADLINE = 1 days;
    uint8 internal constant BOUNTY_TYPE = 0;

    string internal constant REPO = "github.com/yeheskieltame/claudelance-sandbox";
    string internal constant ISSUE = "github.com/yeheskieltame/claudelance-sandbox/issues/e2e-live";

    function run() external {
        address coreAddr = vm.envAddress("CORE_ADDRESS");
        address cusdAddr = vm.envAddress("CUSD_ADDRESS");
        uint256 posterPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 w1Pk = vm.envUint("W1_PRIVATE_KEY");
        uint256 w2Pk = vm.envUint("W2_PRIVATE_KEY");
        uint256 relayerPk = posterPk;

        ClaudelanceCore core = ClaudelanceCore(coreAddr);
        MockCUSD cusd = MockCUSD(cusdAddr);

        address poster = vm.addr(posterPk);
        address w1 = vm.addr(w1Pk);
        address w2 = vm.addr(w2Pk);
        address treasury = core.treasury();

        console2.log("=== IntegrationE2E start ===");
        console2.log("core:       ", coreAddr);
        console2.log("cUSD:       ", cusdAddr);
        console2.log("poster:     ", poster);
        console2.log("w1:         ", w1);
        console2.log("w2:         ", w2);
        console2.log("treasury:   ", treasury);

        uint256 startBountyCount = core.bountyCount();

        // 1+2 poster approves + posts
        vm.startBroadcast(posterPk);
        cusd.approve(coreAddr, AMOUNT);
        uint256 id = core.postBounty(
            BOUNTY_TYPE,
            REPO,
            ISSUE,
            keccak256(abi.encodePacked(REPO, ISSUE, block.timestamp)),
            AMOUNT,
            SLOTS,
            STAKE,
            DEADLINE,
            true
        );
        vm.stopBroadcast();
        console2.log("posted bountyId:", id);

        // 3+4 w1 approves stake + claims
        vm.startBroadcast(w1Pk);
        cusd.approve(coreAddr, STAKE);
        core.claimSlot(id);
        vm.stopBroadcast();

        // 5+6 w2 approves stake + claims
        vm.startBroadcast(w2Pk);
        cusd.approve(coreAddr, STAKE);
        core.claimSlot(id);
        vm.stopBroadcast();

        // 7 w1 submitPR
        vm.startBroadcast(w1Pk);
        core.submitPR(id, string.concat(REPO, "/pull/W1"), keccak256("w1-commit"), "");
        vm.stopBroadcast();

        // 8 w2 submitPR
        vm.startBroadcast(w2Pk);
        core.submitPR(id, string.concat(REPO, "/pull/W2"), keccak256("w2-commit"), "");
        vm.stopBroadcast();

        // 9+10 relayer attests both
        vm.startBroadcast(relayerPk);
        core.attestCI(id, w1, true);
        core.attestCI(id, w2, true);
        vm.stopBroadcast();

        // 11 poster picks winner
        vm.startBroadcast(posterPk);
        core.pickWinner(id, w1);
        vm.stopBroadcast();

        // 12 w1 withdraws earnings
        vm.startBroadcast(w1Pk);
        core.withdrawEarnings();
        vm.stopBroadcast();

        // Post-state reads (off-chain, no gas)
        console2.log("=== Post-state ===");
        console2.log("bountyCount delta:", core.bountyCount() - startBountyCount);
        IClaudelanceCore.Bounty memory b = core.getBounty(id);
        console2.log("bounty status:    ", uint8(b.status));
        console2.log("bounty winner:    ", b.winner);
        console2.log("w1 cUSD balance:  ", cusd.balanceOf(w1));
        console2.log("w2 earnings:      ", core.earnings(w2));
        // treasury and poster share an address in this hackathon setup, so we log
        // absolute balance rather than a delta to avoid uint underflow.
        console2.log("treasury cUSD:    ", cusd.balanceOf(treasury));
        console2.log("totalProtocolRev: ", core.totalProtocolRevenue());

        require(b.status == IClaudelanceCore.BountyStatus.Resolved, "bounty not resolved");
        require(b.winner == w1, "wrong winner");
        require(core.earnings(w2) == STAKE, "w2 good-faith refund missing");
    }
}
