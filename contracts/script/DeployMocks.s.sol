// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

/// @notice Testnet-only - deploys three ERC20 stand-ins (cUSD, CELO, USDC) on
///         Celo Sepolia and seeds the deployer with starting balances so the
///         multi-token bounty flow can be exercised E2E. Refuses to run on mainnet.
contract DeployMocks is Script {
    function run() external returns (MockERC20 cusd, MockERC20 celo, MockERC20 usdc) {
        require(block.chainid != 42_220, "DeployMocks: refusing to run on Celo mainnet");

        address recipient = vm.envOr("MOCK_RECIPIENT", msg.sender);

        vm.startBroadcast();
        cusd = new MockERC20("Mock Celo Dollar", "cUSD", 18);
        celo = new MockERC20("Mock Celo", "CELO", 18);
        usdc = new MockERC20("Mock USD Coin", "USDC", 6);

        cusd.mint(recipient, 10_000e18);
        celo.mint(recipient, 10_000e18);
        usdc.mint(recipient, 10_000e6);
        vm.stopBroadcast();

        console2.log("MockCUSD :", address(cusd));
        console2.log("MockCELO :", address(celo));
        console2.log("MockUSDC :", address(usdc));
        console2.log("recipient:", recipient);
        console2.log("Set CUSD_ADDRESS / CELO_ADDRESS / USDC_ADDRESS in .env to the addresses above.");
    }
}
