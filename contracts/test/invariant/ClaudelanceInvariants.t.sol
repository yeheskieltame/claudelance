// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";

import { ClaudelanceCore } from "../../src/ClaudelanceCore.sol";
import { IClaudelanceCore } from "../../src/interfaces/IClaudelanceCore.sol";
import { MockCUSD } from "../../src/mocks/MockCUSD.sol";
import { MockIdentityRegistry } from "../../src/mocks/MockIdentityRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { ClaudelanceHandler } from "./ClaudelanceHandler.sol";

/// @title  ClaudelanceInvariants
/// @notice Foundry invariant tests for `ClaudelanceCore`. The fuzzer drives random
///         sequences of postBounty/claim/submit/attest/pickWinner/cancel/settle/withdraw
///         through `ClaudelanceHandler`. The invariants below must hold across
///         every reachable state.
contract ClaudelanceInvariants is Test {
    ClaudelanceCore internal core;
    MockCUSD internal cusd;
    MockIdentityRegistry internal identity;
    ClaudelanceHandler internal handler;
    address internal treasury = makeAddr("inv-treasury");
    address internal relayer = makeAddr("inv-relayer");
    address internal owner_ = makeAddr("inv-owner");
    address internal reputation = makeAddr("inv-reputation");

    address[] internal actorAddrs;

    function setUp() public {
        cusd = new MockCUSD();
        identity = new MockIdentityRegistry();
        core = new ClaudelanceCore(treasury, relayer, owner_, IERC721(address(identity)), reputation);
        vm.prank(owner_);
        core.allowToken(IERC20(address(cusd)), 0.5e18);

        address[] memory actors = new address[](5);
        actors[0] = makeAddr("a1");
        actors[1] = makeAddr("a2");
        actors[2] = makeAddr("a3");
        actors[3] = makeAddr("a4");
        actors[4] = makeAddr("a5");
        for (uint256 i = 0; i < actors.length; i++) actorAddrs.push(actors[i]);

        handler = new ClaudelanceHandler(core, cusd, identity, treasury, relayer, actors);

        targetContract(address(handler));

        // Restrict the fuzzer to handler functions only - random calls into core
        // or cUSD would create unreachable states.
        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = ClaudelanceHandler.postBounty.selector;
        selectors[1] = ClaudelanceHandler.claimSlot.selector;
        selectors[2] = ClaudelanceHandler.submitPR.selector;
        selectors[3] = ClaudelanceHandler.attestCI.selector;
        selectors[4] = ClaudelanceHandler.pickWinner.selector;
        selectors[5] = ClaudelanceHandler.cancelExpired.selector;
        selectors[6] = ClaudelanceHandler.settleStake.selector;
        selectors[7] = ClaudelanceHandler.withdrawEarnings.selector;
        selectors[8] = ClaudelanceHandler.withdrawTreasury.selector;
        targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));
    }

    /// I1: the contract's cUSD balance equals net deposits minus net withdrawals.
    ///     If this ever breaks, value has been created or destroyed.
    function invariant_valueConservation() public view {
        uint256 balance = cusd.balanceOf(address(core));
        uint256 expected = handler.totalDepositedByActors() - handler.totalWithdrawnByActors();
        assertEq(balance, expected, "core cUSD balance must equal net deposits");
    }

    /// I2: the contract is always solvent - its cUSD balance must be at least the
    ///     sum of all outstanding `earnings`. (Stronger: it must also cover
    ///     unresolved bounties + unsettled stakes, but I1 already nails that.)
    function invariant_solvency() public view {
        uint256 balance = cusd.balanceOf(address(core));
        address[] memory all = _allKnownAddresses();
        uint256 sumEarnings;
        for (uint256 i = 0; i < all.length; i++) {
            sumEarnings += core.earnings(all[i], address(cusd));
        }
        assertGe(balance, sumEarnings, "core balance must cover all earnings");
    }

    /// I3: `totalBountiesResolved <= bountyCount`. A trivial structural check.
    function invariant_resolvedLeqPosted() public view {
        assertLe(core.totalBountiesResolved(), core.bountyCount());
    }

    /// I4: protocol revenue never decreases (monotonic counter).
    uint256 private _lastRevenue;

    function invariant_protocolRevenueMonotonic() public {
        uint256 r = core.totalProtocolRevenue(address(cusd));
        assertGe(r, _lastRevenue, "totalProtocolRevenue regressed");
        _lastRevenue = r;
    }

    function _allKnownAddresses() internal view returns (address[] memory) {
        uint256 n = actorAddrs.length;
        address[] memory addrs = new address[](n + 2);
        for (uint256 i = 0; i < n; i++) addrs[i] = actorAddrs[i];
        addrs[n] = treasury;
        addrs[n + 1] = relayer;
        return addrs;
    }
}
