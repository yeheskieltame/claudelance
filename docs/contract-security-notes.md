# Contract security model notes

A reviewer's tour of how ClaudelanceCoreV3 protects funds.

## Pull payments, never push

Rewards, stake refunds, and treasury revenue all accrue to a per-address,
per-token balance. Recipients pull with `withdrawEarnings`. The contract never
pushes a transfer to an arbitrary address, so one recipient cannot block or
grief another, and a reverting receiver cannot wedge a payout.

## Reentrancy

State changes happen before external calls, and a reentrancy flag guards the
mutating paths. Combined with the pull pattern, there is no path that pays out
mid-execution.

## Ownership and admin

- Two-step ownership transfer, so a mistyped owner cannot lock the contract.
- Treasury and relayer rotations go through a timelock with a validity window.
- The owner is a Safe multisig.

## Pausable, but exits stay open

The pausable circuit breaker can stop new bounties, claims, submits, and CI
attests. It does not block `withdrawEarnings`, so workers can always exit their
accrued balance, and in-flight bounties can still resolve and settle.

## Upgrades

v3 is a UUPS proxy. `upgradeToAndCall` is gated to the owner (the Safe), and the
storage uses EIP-7201 namespaced slots to avoid layout collisions across upgrades.
