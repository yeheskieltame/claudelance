# On-chain Fee Proof

Every protocol fee Claudelance collects is verifiable on-chain. This page is the canonical reference for auditors and judges to read the live counters directly from the verified contract.

> **Note:** fees accrued to date come from protocol-operated validation bounties (`uniquePosterCount = 1`), so they demonstrate the fee mechanism works - they are not customer or recurring revenue. See [`README.md`](./README.md).

## Contracts to verify

| Component | Address | Network |
|-----------|---------|---------|
| ClaudelanceCore (verified) | [`0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`](https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#code) | Celo Mainnet (42220) |
| Treasury wallet | [`0xCC0cCac212999612BdDdEb607B33CC1a46F8A401`](https://celoscan.io/address/0xCC0cCac212999612BdDdEb607B33CC1a46F8A401) | Celo Mainnet |

## Read `totalProtocolRevenue(token)` for each token

The 2% protocol fee plus forfeited stakes accrue into per-token counters on the Core. Anyone can read these via `cast call`:

```bash
# cUSD
cast call --rpc-url https://forno.celo.org \
  0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423 \
  "totalProtocolRevenue(address)(uint256)" \
  0x765DE816845861e75A25fCA122bb6898B8B1282a

# CELO (ERC20)
cast call --rpc-url https://forno.celo.org \
  0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423 \
  "totalProtocolRevenue(address)(uint256)" \
  0x471EcE3750Da237f93B8E339c536989b8978a438

# USDC
cast call --rpc-url https://forno.celo.org \
  0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423 \
  "totalProtocolRevenue(address)(uint256)" \
  0xcebA9300f2b948710d2653dD7B07f33A8B32118C
```

Divide each return value by the token's decimals (cUSD/CELO = 18, USDC = 6) for human-readable amount.

## Event log filter

Each fee accrual emits a `ProtocolRevenueAccrued(address indexed token, uint256 amount, uint256 cumulative)` event. Celoscan event filter:

[https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#events](https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#events)

Filter by topic[0] = `keccak256("ProtocolRevenueAccrued(address,uint256,uint256)")` and topic[1] = token address (left-padded to 32 bytes).

## Verify treasury earnings claimable balance

`earnings[treasury][token]` is the un-withdrawn portion (revenue accrued but not yet swept by `withdrawEarnings`):

```bash
cast call --rpc-url https://forno.celo.org \
  0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423 \
  "earnings(address,address)(uint256)" \
  0xCC0cCac212999612BdDdEb607B33CC1a46F8A401 \
  0x471EcE3750Da237f93B8E339c536989b8978a438
```

## Snapshot - 2026-05-25

All values read live from the Core via `cast call` (see commands above) and `getStats(CELO)`.

| Metric | Value |
|--------|-------|
| Resolved bounties (`totalBountiesResolved`) | 80 |
| Total bounties posted (`bountyCount`) | 96 |
| Total bounty volume (`getStats(CELO)`) | 96 CELO |
| `totalProtocolRevenue(CELO)` | 1.60 CELO |
| `totalProtocolRevenue(cUSD)` | 0 (no cUSD bounties yet on mainnet) |
| `totalProtocolRevenue(USDC)` | 0 (no USDC bounties yet on mainnet) |
| Operator validation wallets (`uniqueWorkerCount`) | 30 (`uniquePosterCount` = 1) |
| CELO spot price | ~$0.0798 (CoinGecko, last checked 2026-05-20) |
| USD-equivalent protocol revenue | ~$0.13 |
| USD-equivalent volume | ~$7.66 |

Numbers grow with every resolved bounty. Cross-check at the Celoscan link any time. USD figures move with the CELO spot price - recompute against the live rate before publishing.
