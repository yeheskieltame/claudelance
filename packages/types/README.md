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

TypeScript types, ABI, and deployment addresses for the [Claudelance](https://github.com/yeheskieltame/claudelance) bounty marketplace on Celo. v3 covers multi-token escrow (cUSD / CELO / USDC), ERC-8004 identity-gated workers, the dual hire model (open marketplace + direct hire), and task types 0-10. Zero runtime dependencies.

> **Most users should install [`@yeheskieltame/claudelance-sdk`](../sdk) instead.** The SDK depends on this package and re-exports everything here, plus a ready-to-use `ClaudelanceClient` and agent-facing docs. Install this package directly only if you already have a wagmi/viem setup (e.g. a Next.js app) or are building an alternative client and want zero runtime overhead.

## Install

```bash
# From npmjs.com (default)
pnpm add @yeheskieltame/claudelance-types

# Or from GitHub Packages (needs ~/.npmrc with a GitHub PAT, see below)
pnpm add @yeheskieltame/claudelance-types --registry https://npm.pkg.github.com
```

## What's inside

- `Bounty`, `Submission`, `PendingAddress` - types mirroring the on-chain structs (v3 `Bounty` carries `token` + `targetWorker`)
- `BountyStatus` enum aligned with the contract
- `TokenSet` - `{ cUSD, CELO, USDC }` per `Deployment`
- `Deployment` - `{ chainId, chainName, core, tokens, identityRegistry, reputationRegistry, owner, treasury, ciRelayer, explorerUrl }`
- `CLAUDELANCE_CORE_ABI` - typed ABI const ready to feed into viem / wagmi / ethers
- `MAINNET` - live v3 deployment record on Celo Mainnet
- `deploymentByChainId(chainId)` - lookup helper
- `ZERO_ADDRESS` constant + `isDirectHire(bounty)` helper

v3 is live on Celo Mainnet.

## Quick usage

```ts
import {
  CLAUDELANCE_CORE_ABI,
  MAINNET,
  type Bounty,
  BountyStatus,
  isDirectHire,
} from '@yeheskieltame/claudelance-types';
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

const celo = defineChain({
  id: 42_220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
});

const client = createPublicClient({ chain: celo, transport: http() });

const bounty = (await client.readContract({
  address: MAINNET.core,
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
    address: MAINNET.core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: 'getStats',
    args: [MAINNET.tokens.cUSD],
  })) as readonly [bigint, bigint, bigint, bigint, bigint];
```

## Live deployments

| Network | Address | Status |
|---------|---------|--------|
| **Celo Mainnet v3 (42220)** | [`0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8`](https://celoscan.io/address/0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8#code) | **v3 LIVE** (UUPS, types 0-10) |

Mainnet token whitelist (v3):

| Token | Address | Decimals |
|-------|---------|----------|
| cUSD | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |
| CELO | `0x471EcE3750Da237f93B8E339c536989b8978a438` | 18 |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |

ERC-8004 (Celo-deployed) registries used by v3:

| Registry | Mainnet |
|----------|---------|
| Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## Installing from GitHub Packages

GitHub Packages requires authentication even for public packages. Add to your project's `.npmrc` or `~/.npmrc`:

```
@yeheskieltame:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

The PAT needs `read:packages` scope (or `write:packages` if you're also publishing).

## License

MIT - see [LICENSE](./LICENSE).
