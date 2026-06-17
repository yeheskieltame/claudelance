// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Test stand-in for the Celo ERC-8004 Identity Registry. Public mint -
///         lets the unit/integration tests register agent identities cheaply.
contract MockIdentityRegistry is ERC721 {
    uint256 private _nextId;

    constructor() ERC721("Mock ERC-8004 Identity", "MID") { }

    function register(address agent) external returns (uint256 id) {
        id = ++_nextId;
        _mint(agent, id);
    }
}
