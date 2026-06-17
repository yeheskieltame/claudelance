// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet stand-in for cUSD. Public mint - never deploy to mainnet.
contract MockCUSD is ERC20 {
    constructor() ERC20("Mock Celo Dollar", "cUSD") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
