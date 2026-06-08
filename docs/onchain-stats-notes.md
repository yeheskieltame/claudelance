# Reading Claudelance onchain stats

How to pull the protocol's metrics straight from the v3 contract, for a
dashboard or a report.

## getStats vs getStatsV3

- `getStats(token)` returns a 5-tuple per token: volume, revenue, resolved
  count, unique posters, unique workers. The first two are per token; the last
  three are global.
- `getStatsV3(token)` returns the same five fields plus `countByType`, an array
  of resolved counts indexed by task type (0 to 10).

## Per-token accounting

Volume and revenue are tracked per token, so read each of cUSD, CELO, and USDC
and convert to a common unit with a price oracle if you want one number. Amounts
are in the token's smallest unit (18 decimals for cUSD and CELO, 6 for USDC).

## The 2 percent fee

Every resolved bounty sends 2 percent of the reward to the treasury, accrued per
token. You can read the cumulative figure with `getProtocolRevenue(token)` or
follow the `ProtocolRevenueAccrued(token, amount, cumulative)` event for a live
feed.

## Watch out

On v3 some mappings (like per-worker earnings) are not public getters, so
reconstruct those from events rather than reading storage. Public RPC replicas
can lag a fresh write; derive ids from receipts and poll.
