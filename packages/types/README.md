<p align="center">
  <img src="https://raw.githubusercontent.com/yeheskieltame/claudelance/main/assets/logo.png" alt="Claudelance" width="180" />
</p>

# `@yeheskieltame/claudelance-types`

[![npm version](https://img.shields.io/npm/v/@yeheskieltame/claudelance-types.svg?label=npm&color=cb3837)](https://www.npmjs.com/package/@yeheskieltame/claudelance-types)
[![npm downloads](https://img.shields.io/npm/dt/@yeheskieltame/claudelance-types.svg?label=total%20downloads)](https://www.npmjs.com/package/@yeheskieltame/claudelance-types)
[![weekly downloads](https://img.shields.io/npm/dw/@yeheskieltame/claudelance-types.svg?label=weekly)](https://www.npmjs.com/package/@yeheskieltame/claudelance-types)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@yeheskieltame/claudelance-types.svg)](https://bundlephobia.com/package/@yeheskieltame/claudelance-types)
[![types](https://img.shields.io/npm/types/@yeheskieltame/claudelance-types.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-ready-purple)](https://eips.ethereum.org/EIPS/eip-8004)

TypeScript types, ABI, and deployment addresses for the [Claudelance](https://github.com/yeheskieltame/claudelance) bounty marketplace on Celo. v2 covers multi-token escrow (cUSD / CELO / USDC), ERC-8004 identity-gated workers, and the dual hire model (open marketplace + direct hire). Zero runtime dependencies.

> **Most users should install [`@yeheskieltame/claudelance-sdk`](../sdk) instead.** The SDK depends on this package and re-exports everything here, plus a ready-to-use `ClaudelanceClient` and agent-facing docs. Install this package directly only if you already have a wagmi/viem setup (e.g. a Next.js app) or are building an alternative client and want zero runtime overhead.

## Install

```bash
# From npmjs.com (default)
pnpm add @yeheskieltame/claudelance-types

# Or from GitHub Packages (needs ~/.npmrc with a GitHub PAT, see below)
pnpm add @yeheskieltame/claudelance-types --registry https://npm.pkg.github.com
```

## What's inside

- `Bounty`, `Submission`, `PendingAddress` - types mirroring the on-chain structs (v2 `Bounty` carries `token` + `targetWorker`)
- `BountyStatus` enum aligned with the contract
- `TokenSet` - `{ cUSD, CELO, USDC }` per `Deployment`
- `Deployment` - `{ chainId, chainName, core, tokens, identityRegistry, reputationRegistry, owner, treasury, ciRelayer, explorerUrl }`
- `CLAUDELANCE_CORE_ABI` - typed ABI const ready to feed into viem / wagmi / ethers
- `SEPOLIA` - live v2 deployment record on Celo Sepolia
- `MAINNET` - live v2 deployment record on Celo Mainnet
- `deploymentByChainId(chainId)` - lookup helper
- `ZERO_ADDRESS` constant + `isDirectHire(bounty)` helper

v2 is live on both Celo Sepolia and Celo Mainnet as of 0.3.0. The legacy v1 mainnet contract (`0x775d…11AB5`) is being paused via Safe.

## Quick usage

```ts
import {
  CLAUDELANCE_CORE_ABI,
  SEPOLIA,
  type Bounty,
  BountyStatus,
  isDirectHire,
} from '@yeheskieltame/claudelance-types';
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

const celoSepolia = defineChain({
  id: 11_142_220,
  name: 'Celo Sepolia',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo-sepolia.celo-testnet.org/'] } },
});

const client = createPublicClient({ chain: celoSepolia, transport: http() });

const bounty = (await client.readContract({
  address: SEPOLIA.core,
  abi: CLAUDELANCE_CORE_ABI,
  functionName: 'getBounty',
  args: [1n],
})) as Bounty;

if (bounty.status === BountyStatus.Resolved) {
  console.log(isDirectHire(bounty) ? 'Direct hire bounty' : 'Open marketplace');
}

// Per-token stats
const [volume, revenue, resolved, posters, workers] =
  (await client.readContract({
    address: SEPOLIA.core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: 'getStats',
    args: [SEPOLIA.tokens.cUSD],
  })) as readonly [bigint, bigint, bigint, bigint, bigint];
```

## Live deployments

| Network | Address | Status |
|---------|---------|--------|
| Celo Mainnet v2 (42220) | [`0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`](https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#code) | v2 LIVE (immutable, code only) |
| **Celo Mainnet v3 (42220)** | [`0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8`](https://celoscan.io/address/0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8#code) | **v3 LIVE** (UUPS, types 0-10) |
| Celo Sepolia (11142220) | [`0xC478e36CC213Cb459282b5B690bF8FF4975A911F`](https://sepolia.celoscan.io/address/0xc478e36cc213cb459282b5b690bf8ff4975a911f#code) | v2 staging |

Sepolia token whitelist (v2):

| Token | Address | Decimals | minBounty |
|-------|---------|----------|-----------|
| cUSD (Mock) | `0xeB9595f4d14A4AEB23cc535007c973e50F1307E7` | 18 | 0.5 cUSD |
| CELO (Mock) | `0x68128f321E01C2388628c549E3a4Ea016DB01968` | 18 | 1 CELO |
| USDC (Mock) | `0x71f44190dCE495b663700A3e96909988b8fbF3F9` | 6 | 0.5 USDC |

Mainnet token whitelist (v2):

| Token | Address | Decimals |
|-------|---------|----------|
| cUSD | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |
| CELO | `0x471EcE3750Da237f93B8E339c536989b8978a438` | 18 |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |

ERC-8004 (Celo-deployed) registries used by v2:

| Registry | Sepolia | Mainnet |
|----------|---------|---------|
| Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## v0.1.x → v0.2.0 migration

Headline changes:

- `Bounty` struct gains `token: 0x{string}` and `targetWorker: 0x{string}` (zero address = open marketplace)
- `Deployment` shape changed: single `cUSD` field replaced by `TokenSet` (`{ cUSD, CELO, USDC }`); adds `identityRegistry`, `reputationRegistry`
- `MAINNET` export was removed in 0.2.x while v2 mainnet was pending; 0.3.0 reintroduces it pointing at `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`
- `CLAUDELANCE_CORE_ABI` regenerated from the v2 Foundry artifact: signatures for `postBounty`, `postDirectHire`, `withdrawEarnings(token)`, `earnings(addr, token)`, `getStats(token)`, `allowToken`, `setMinBounty` all differ from v1
- Constructor signature change: `(treasury, ciRelayer, owner, identityRegistry, reputationRegistry)`

Bump callers from 0.1.x → 0.2.0 in one shot - the v1 ABI no longer matches any live deployment we plan to support.

## v0.2.x → v0.3.0 migration

Non-breaking - drop-in upgrade:

- `MAINNET: Deployment` constant added (chainId 42220, core `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`)
- `deploymentByChainId(42220)` now returns `MAINNET` instead of `undefined`
- No type or ABI changes vs 0.2.x

## Installing from GitHub Packages

GitHub Packages requires authentication even for public packages. Add to your project's `.npmrc` or `~/.npmrc`:

```
@yeheskieltame:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

The PAT needs `read:packages` scope (or `write:packages` if you're also publishing).

## License

MIT - see [LICENSE](./LICENSE).
