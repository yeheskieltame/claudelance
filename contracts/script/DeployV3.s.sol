// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ClaudelanceCoreV3 } from "../src/v3/ClaudelanceCoreV3.sol";
import { ClaudelanceProxy } from "../src/v3/ClaudelanceProxy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TypeConfig } from "../src/v3/types/ClaudelanceTypes.sol";
import { TaskTypeLib } from "../src/v3/libraries/TaskTypeLib.sol";

/// @notice Deploys ClaudelanceCoreV3 + ClaudelanceProxy, initializes, and
///         whitelists cUSD / CELO / USDC.
///
/// Required env vars (both networks):
///   TREASURY_ADDRESS, CI_RELAYER_ADDRESS, OWNER_ADDRESS
///   IDENTITY_REGISTRY_ADDRESS, REPUTATION_REGISTRY_ADDRESS
///   CUSD_ADDRESS, CELO_ADDRESS, USDC_ADDRESS
///   (min bounty amounts default to 0.5 / 1.0 / 0.5 tokens)
///
/// Mainnet only:
///   ALLOW_SHARED_ADMIN_WALLETS must NOT be set (or set to false)
///   - Deploy.s.sol enforces 4-key separation on chainid 42220.
contract DeployV3 is Script {
    // ── Min bounty floors (18 decimals for cUSD/CELO, 6 for USDC) ──
    uint256 constant MIN_CUSD = 0.5e18;
    uint256 constant MIN_CELO = 1e18;
    uint256 constant MIN_USDC = 0.5e6;

    function run() external {
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address ciRelayer = vm.envAddress("CI_RELAYER_ADDRESS");
        address owner = vm.envAddress("OWNER_ADDRESS");
        address identityReg = vm.envAddress("IDENTITY_REGISTRY_ADDRESS");
        address reputationReg = vm.envAddress("REPUTATION_REGISTRY_ADDRESS");
        address cusd = vm.envAddress("CUSD_ADDRESS");
        address celo = vm.envAddress("CELO_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");

        bool allowShared = vm.envOr("ALLOW_SHARED_ADMIN_WALLETS", false);

        // On mainnet, enforce 4-key separation to prevent single-key compromise
        if (block.chainid == 42220 && !allowShared) {
            address deployer = msg.sender;
            require(deployer != owner, "DeployV3: deployer == owner");
            require(deployer != treasury, "DeployV3: deployer == treasury");
            require(deployer != ciRelayer, "DeployV3: deployer == ciRelayer");
            require(owner != treasury, "DeployV3: owner == treasury");
            require(owner != ciRelayer, "DeployV3: owner == ciRelayer");
            require(treasury != ciRelayer, "DeployV3: treasury == ciRelayer");
        }

        vm.startBroadcast();

        // 1. Deploy implementation (initializers disabled in constructor)
        ClaudelanceCoreV3 impl = new ClaudelanceCoreV3();
        console2.log("Implementation:", address(impl));

        // 2. Encode initialize() call for proxy constructor
        bytes memory initData = abi.encodeCall(
            ClaudelanceCoreV3.initialize,
            (treasury, ciRelayer, owner, identityReg, reputationReg)
        );

        // 3. Deploy proxy - calls initialize() atomically
        ClaudelanceProxy proxy = new ClaudelanceProxy(address(impl), initData);
        console2.log("Proxy (ClaudelanceCoreV3):", address(proxy));

        // 4. Whitelist tokens via the proxy
        // Note: on mainnet, the owner is a Safe multisig so these calls
        // must be submitted separately through the Safe UI after deploy.
        // On Sepolia (single key), we can do it here.
        if (block.chainid != 42220) {
            ClaudelanceCoreV3 core = ClaudelanceCoreV3(address(proxy));
            core.allowToken(IERC20(cusd), MIN_CUSD);
            console2.log("allowToken: cUSD");
            core.allowToken(IERC20(celo), MIN_CELO);
            console2.log("allowToken: CELO");
            core.allowToken(IERC20(usdc), MIN_USDC);
            console2.log("allowToken: USDC");
        } else {
            console2.log("Mainnet: run allowToken through Safe multisig after deploy.");
        }

        vm.stopBroadcast();

        // 5. Write deployment record
        string memory chain = block.chainid == 42220 ? "celo-mainnet-v3" : "celo-sepolia-v3";
        console2.log("Chain:", chain);
        console2.log("Proxy address (save this):", address(proxy));
        console2.log("Implementation:", address(impl));
    }
}
