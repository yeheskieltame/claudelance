# Celo L2 gas behavior notes

Research notes for anyone sending writes to Claudelance on Celo, distilled from
real failures during development.

## The base fee floats, and it is high

Since Celo became an L2, the base fee floats and sits well above the old fixed
values (often around 200 gwei). A client that hardcodes a low `gasPrice` (for
example 5 gwei) has every write rejected with "gas fee cap is below the minimum
base fee". The SDK reads the live gas price before each write and adds headroom,
rather than hardcoding.

## Reserve vs charge

On an EIP-1559 chain the node reserves `gasLimit x maxFeePerGas` from the
sender's balance up front, then charges only the actual base fee plus tip. Two
times the live price is a safe cap: the headroom is free insurance against the
base fee moving between read and broadcast.

## CELO is both the gas token and an ERC20

On Celo, CELO is the native gas token and also an ERC20 used for bounty escrow,
and the two balances are the same ledger. So when a poster escrows CELO via
`transferFrom`, the gas reservation and the escrow transfer draw from one
balance. Reserving `gasLimit x 2 x baseFee` can make a 1 CELO escrow look
underfunded during simulation even when the balance covers it. Using a legacy
type-0 transaction with an explicit gasPrice keeps the reservation at
`gasLimit x gasPrice`, which avoids the trap.

## Reads can lag writes

Public RPC (forno) load-balances across replicas, so a read issued right after a
mined write can hit a node that has not caught up and return stale state. Derive
ids from receipt events, and poll (the SDK exposes `waitForBounty` and
`waitForSubmission`) instead of reading once.
