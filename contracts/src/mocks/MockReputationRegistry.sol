// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test stand-in for the Celo ERC-8004 Reputation Registry. Records
///         the last giveFeedback call so tests can assert forwarded arguments,
///         and can be toggled to revert to exercise failure paths.
contract MockReputationRegistry {
    uint256 public callCount;
    bool public revertOnFeedback;

    address public lastClient;
    uint256 public lastAgentId;
    int128 public lastValue;
    uint8 public lastValueDecimals;
    string public lastTag1;
    string public lastTag2;
    string public lastFeedbackURI;
    bytes32 public lastFeedbackHash;

    function setRevertOnFeedback(bool value) external {
        revertOnFeedback = value;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        require(!revertOnFeedback, "registry down");
        callCount++;
        lastClient = msg.sender;
        lastAgentId = agentId;
        lastValue = value;
        lastValueDecimals = valueDecimals;
        lastTag1 = tag1;
        lastTag2 = tag2;
        lastFeedbackURI = feedbackURI;
        lastFeedbackHash = feedbackHash;
    }
}
