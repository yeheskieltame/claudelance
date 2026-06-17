# Claudelance Revenue Model

Claudelance is a fully on-chain bounty marketplace. The protocol fee is collected by the smart contract and held publicly on Celo Mainnet - no payment processor, no off-chain ledger.

> **Status: pre-revenue.** The 2% protocol fee is live and every accrual is verifiable on-chain, but all fees to date come from **protocol-operated validation bounties** - a single operator posting bounties and running its own ERC-8004 agent wallets (`uniquePosterCount = 1` on-chain). This proves the fee mechanism works end-to-end; it is **not** customer or recurring revenue and must not be reported as MRR until there is genuine third-party usage.

## How revenue is generated

For every resolved bounty:

| Source | Rate | Token | Destination |
|--------|------|-------|-------------|
| Protocol fee | 2% of bounty `amount` | same token as the bounty | `earnings[treasury][token]` |
| Stake forfeit | full `stakeRequired` of any claimer that did not submit (or whose CI failed when required) | same token as the bounty | `earnings[treasury][token]` |

Treasury is a distinct wallet from owner, deployer, and CI relayer:
- Mainnet treasury: [`0xCC0cCac212999612BdDdEb607B33CC1a46F8A401`](https://celoscan.io/address/0xCC0cCac212999612BdDdEb607B33CC1a46F8A401)

Settlement uses a pull pattern: `pickWinner` and `settleStake` credit `earnings[*][token]`, but no token actually moves until the recipient calls `withdrawEarnings(token)`.

## Reading live revenue

The Core contract exposes per-token cumulative revenue as a public view:

```solidity
mapping(address => uint256) public totalProtocolRevenue;
```

Read from Celo Mainnet Core (`0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`):

```bash
cast call --rpc-url celo \
  0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423 \
  "totalProtocolRevenue(address)(uint256)" \
  0x471EcE3750Da237f93B8E339c536989b8978a438   # CELO ERC20
```

Equivalent JavaScript via the SDK:

```ts
import { ClaudelanceClient, MAINNET } from '@yeheskieltame/claudelance-sdk';
const client = ClaudelanceClient.fromPrivateKey({ privateKey, network: 'celo' });
const celoRev = await client.getProtocolRevenue(MAINNET.tokens.CELO);
```

## Verifier-friendly resources

- On-chain proof + Celoscan links + `cast` commands: [`onchain-proof.md`](./onchain-proof.md)
- Live revenue dashboard (frontend): [`/revenue`](../../apps/web/app/revenue)

## Snapshot - 2026-05-25 mainnet (operator validation)

- 80 of 96 bounties resolved on Celo Mainnet
- 1.60 CELO accrued in `totalProtocolRevenue(CELO)` from 2% fees + stake forfeits (~$0.13 at CELO ~$0.0798)
- 96 CELO total bounty volume across 30 operator-run validation wallets (`uniquePosterCount = 1`)
- cUSD and USDC accrual still 0 (no bounties posted in those tokens yet on mainnet)
- These figures reflect operator dogfooding of the fee mechanism, not customer revenue
