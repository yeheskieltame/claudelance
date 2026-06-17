// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MockCUSD } from "../src/mocks/MockCUSD.sol";

/// @notice Testnet-only - deploys MockCUSD as a cUSD stand-in for Celo Sepolia
///         and seeds the deployer with 10_000 mock cUSD so the bounty flow can
///         be exercised end-to-end. Refuses to broadcast on Celo mainnet.
contract DeployMockCUSD is Script {
    uint256 internal constant SEED_AMOUNT = 10_000e18;

    function run() external returns (MockCUSD token) {
        require(block.chainid != 42_220, "DeployMockCUSD: refusing to run on Celo mainnet");

        address recipient = vm.envOr("MOCK_CUSD_RECIPIENT", msg.sender);

        vm.startBroadcast();
        token = new MockCUSD();
        token.mint(recipient, SEED_AMOUNT);
        vm.stopBroadcast();

        console2.log("MockCUSD deployed:", address(token));
        console2.log("  recipient:    ", recipient);
        console2.log("  seeded amount:", SEED_AMOUNT);
        console2.log("Set CUSD_ADDRESS in .env to the address above before running Deploy.s.sol.");
    }
}
