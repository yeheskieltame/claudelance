// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal surface of the Celo-deployed ERC-8004 Reputation Registry
///         (mainnet 0x8004BAa1…9b63, Sepolia 0x8004B663…8713). The registry
///         records msg.sender as the feedback client and rejects calls from
///         the agent's owner/operators, so the Claudelance core (neither) may
///         attest on behalf of the protocol.
interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
}
