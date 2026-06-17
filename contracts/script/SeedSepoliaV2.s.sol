// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ClaudelanceCore } from "../src/ClaudelanceCore.sol";
import { IClaudelanceCore } from "../src/interfaces/IClaudelanceCore.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

interface IIdentityRegistry {
    function register() external returns (uint256);
    function balanceOf(address) external view returns (uint256);
}

/// @notice E2E exercise on Celo Sepolia: register 3 agents in ERC-8004,
///         seed worker balances + allowances, post 5 open + 2 direct-hire
///         bounties across cUSD / CELO / USDC, drive claims + submissions +
///         resolutions + stake settlement + withdrawals. ~60 tx in one run.
contract SeedSepoliaV2 is Script {
    ClaudelanceCore internal core;
    IIdentityRegistry internal id8004;

    MockERC20 internal cusd;
    MockERC20 internal celo;
    MockERC20 internal usdc;

    uint256 internal deployerKey;
    uint256 internal w1Key;
    uint256 internal w2Key;
    address internal deployer;
    address internal w1;
    address internal w2;

    function run() external {
        require(block.chainid != 42_220, "SeedSepoliaV2: refusing to run on Celo mainnet");

        core = ClaudelanceCore(vm.envAddress("CORE_ADDRESS"));
        id8004 = IIdentityRegistry(vm.envAddress("IDENTITY_REGISTRY_ADDRESS"));
        cusd = MockERC20(vm.envAddress("CUSD_ADDRESS"));
        celo = MockERC20(vm.envAddress("CELO_ADDRESS"));
        usdc = MockERC20(vm.envAddress("USDC_ADDRESS"));

        deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        w1Key = vm.envUint("W1_PRIVATE_KEY");
        w2Key = vm.envUint("W2_PRIVATE_KEY");
        deployer = vm.addr(deployerKey);
        w1 = vm.addr(w1Key);
        w2 = vm.addr(w2Key);

        console2.log("=== SeedSepoliaV2 start ===");
        console2.log("Core    :", address(core));
        console2.log("ID8004  :", address(id8004));
        console2.log("deployer:", deployer);
        console2.log("w1      :", w1);
        console2.log("w2      :", w2);

        _registerAgents();
        _fundWorkers();
        _approveTokens();
        uint256[] memory ids = _postBounties();
        _workersClaimAndSubmit(ids);
        _posterPicksWinners(ids);
        _settleAll(ids);
        _workersWithdraw();

        console2.log("=== SeedSepoliaV2 done ===");
        (uint256 volCusd,,,, ) = core.getStats(IERC20(address(cusd)));
        (uint256 volCelo,,,, ) = core.getStats(IERC20(address(celo)));
        (uint256 volUsdc,,,, ) = core.getStats(IERC20(address(usdc)));
        console2.log("totalBountyVolume cUSD:", volCusd);
        console2.log("totalBountyVolume CELO:", volCelo);
        console2.log("totalBountyVolume USDC:", volUsdc);
        console2.log("totalBountiesResolved:", core.totalBountiesResolved());
        console2.log("uniquePosterCount    :", core.uniquePosterCount());
        console2.log("uniqueWorkerCount    :", core.uniqueWorkerCount());
    }

    function _registerAgents() internal {
        if (id8004.balanceOf(deployer) == 0) {
            vm.broadcast(deployerKey);
            id8004.register();
        }
        if (id8004.balanceOf(w1) == 0) {
            vm.broadcast(w1Key);
            id8004.register();
        }
        if (id8004.balanceOf(w2) == 0) {
            vm.broadcast(w2Key);
            id8004.register();
        }
    }

    function _fundWorkers() internal {
        // Each worker gets ample balance in all 3 tokens.
        vm.startBroadcast(deployerKey);
        cusd.mint(w1, 50e18);
        cusd.mint(w2, 50e18);
        celo.mint(w1, 50e18);
        celo.mint(w2, 50e18);
        usdc.mint(w1, 50e6);
        usdc.mint(w2, 50e6);
        vm.stopBroadcast();
    }

    function _approveTokens() internal {
        vm.startBroadcast(deployerKey);
        cusd.approve(address(core), type(uint256).max);
        celo.approve(address(core), type(uint256).max);
        usdc.approve(address(core), type(uint256).max);
        vm.stopBroadcast();

        vm.startBroadcast(w1Key);
        cusd.approve(address(core), type(uint256).max);
        celo.approve(address(core), type(uint256).max);
        usdc.approve(address(core), type(uint256).max);
        vm.stopBroadcast();

        vm.startBroadcast(w2Key);
        cusd.approve(address(core), type(uint256).max);
        celo.approve(address(core), type(uint256).max);
        usdc.approve(address(core), type(uint256).max);
        vm.stopBroadcast();
    }

    function _postBounties() internal returns (uint256[] memory ids) {
        ids = new uint256[](7);
        string memory repo = "github.com/yeheskieltame/claudelance";

        vm.startBroadcast(deployerKey);

        // 5 open marketplace bounties - vary token, amount, slots, ci off
        ids[0] = core.postBounty(
            IERC20(address(cusd)), 0, repo, "github.com/yeheskieltame/claudelance/issues/100",
            bytes32(0), 1e18, 3, 0.05e18, 1 days, false
        );
        ids[1] = core.postBounty(
            IERC20(address(celo)), 0, repo, "github.com/yeheskieltame/claudelance/issues/101",
            bytes32(0), 2e18, 2, 0.1e18, 1 days, false
        );
        ids[2] = core.postBounty(
            IERC20(address(usdc)), 0, repo, "github.com/yeheskieltame/claudelance/issues/102",
            bytes32(0), 1e6, 2, 0.05e6, 1 days, false
        );
        ids[3] = core.postBounty(
            IERC20(address(cusd)), 0, repo, "github.com/yeheskieltame/claudelance/issues/103",
            bytes32(0), 1.5e18, 1, 0.1e18, 1 days, false
        );
        ids[4] = core.postBounty(
            IERC20(address(cusd)), 0, repo, "github.com/yeheskieltame/claudelance/issues/104",
            bytes32(0), 0.7e18, 2, 0.05e18, 2 days, false
        );

        // 2 direct-hire bounties
        ids[5] = core.postDirectHire(
            IERC20(address(cusd)), w1, 0, repo, "github.com/yeheskieltame/claudelance/issues/200",
            bytes32(0), 2e18, 0.1e18, 1 days
        );
        ids[6] = core.postDirectHire(
            IERC20(address(celo)), w2, 0, repo, "github.com/yeheskieltame/claudelance/issues/201",
            bytes32(0), 3e18, 0.2e18, 1 days
        );

        vm.stopBroadcast();

        for (uint256 i = 0; i < ids.length; i++) {
            console2.log("bounty id:", ids[i]);
        }
    }

    function _workersClaimAndSubmit(uint256[] memory ids) internal {
        // W1: claim 0,1,2,3,5; submit on all but skip on 2 (we want w2 to win 2)
        vm.startBroadcast(w1Key);
        core.claimSlot(ids[0]);
        core.claimSlot(ids[1]);
        core.claimSlot(ids[2]);
        core.claimSlot(ids[3]);
        core.claimSlot(ids[5]);
        core.submitPR(ids[0], "github.com/yeheskieltame/claudelance/pull/100", bytes32(uint256(0x1)), "{\"agent\":\"w1\"}");
        core.submitPR(ids[1], "github.com/yeheskieltame/claudelance/pull/101", bytes32(uint256(0x2)), "{\"agent\":\"w1\"}");
        core.submitPR(ids[3], "github.com/yeheskieltame/claudelance/pull/103", bytes32(uint256(0x3)), "{\"agent\":\"w1\"}");
        core.submitPR(ids[5], "github.com/yeheskieltame/claudelance/pull/200", bytes32(uint256(0x4)), "{\"agent\":\"w1\"}");
        vm.stopBroadcast();

        // W2: claim 0,2,4,6; submit on 2,4,6 - never submits on 0 (forfeit test)
        vm.startBroadcast(w2Key);
        core.claimSlot(ids[0]);
        core.claimSlot(ids[2]);
        core.claimSlot(ids[4]);
        core.claimSlot(ids[6]);
        core.submitPR(ids[2], "github.com/yeheskieltame/claudelance/pull/102", bytes32(uint256(0x5)), "{\"agent\":\"w2\"}");
        core.submitPR(ids[4], "github.com/yeheskieltame/claudelance/pull/104", bytes32(uint256(0x6)), "{\"agent\":\"w2\"}");
        core.submitPR(ids[6], "github.com/yeheskieltame/claudelance/pull/201", bytes32(uint256(0x7)), "{\"agent\":\"w2\"}");
        vm.stopBroadcast();
    }

    function _posterPicksWinners(uint256[] memory ids) internal {
        vm.startBroadcast(deployerKey);
        core.pickWinner(ids[0], w1);
        core.pickWinner(ids[1], w1);
        core.pickWinner(ids[2], w2);
        core.pickWinner(ids[3], w1);
        core.pickWinner(ids[4], w2);
        core.pickWinner(ids[5], w1);
        core.pickWinner(ids[6], w2);
        vm.stopBroadcast();
    }

    function _settleAll(uint256[] memory ids) internal {
        // Anyone can call settleStake. Deployer sweeps everyone.
        vm.startBroadcast(deployerKey);
        for (uint256 i = 0; i < ids.length; i++) {
            address[] memory claimers = core.getClaimers(ids[i]);
            for (uint256 j = 0; j < claimers.length; j++) {
                core.settleStake(ids[i], claimers[j]);
            }
        }
        vm.stopBroadcast();
    }

    function _workersWithdraw() internal {
        // W1 has cUSD + CELO earnings; W2 has cUSD + CELO + USDC.
        vm.startBroadcast(w1Key);
        if (core.earnings(w1, address(cusd)) > 0) core.withdrawEarnings(IERC20(address(cusd)));
        if (core.earnings(w1, address(celo)) > 0) core.withdrawEarnings(IERC20(address(celo)));
        vm.stopBroadcast();

        vm.startBroadcast(w2Key);
        if (core.earnings(w2, address(cusd)) > 0) core.withdrawEarnings(IERC20(address(cusd)));
        if (core.earnings(w2, address(celo)) > 0) core.withdrawEarnings(IERC20(address(celo)));
        if (core.earnings(w2, address(usdc)) > 0) core.withdrawEarnings(IERC20(address(usdc)));
        vm.stopBroadcast();
    }
}
