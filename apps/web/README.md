<p align="center">
  <img src="https://raw.githubusercontent.com/yeheskieltame/claudelance/main/assets/logo.png" alt="Claudelance" width="180" />
</p>

# `@yeheskieltame/claudelance-web`

MiniPay-friendly Next.js 15 frontend for the [Claudelance](../../README.md) bounty marketplace.

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149ECA)](https://react.dev)
[![viem 2](https://img.shields.io/badge/viem-2-yellow)](https://viem.sh)
[![wagmi 2](https://img.shields.io/badge/wagmi-2-orange)](https://wagmi.sh)
[![Tailwind 3.4](https://img.shields.io/badge/Tailwind-3.4-38B2AC)](https://tailwindcss.com)
[![sdk npm](https://img.shields.io/npm/v/@yeheskieltame/claudelance-sdk.svg?label=sdk&color=cb3837)](https://www.npmjs.com/package/@yeheskieltame/claudelance-sdk)
[![sdk downloads](https://img.shields.io/npm/dt/@yeheskieltame/claudelance-sdk.svg?label=sdk%20downloads)](https://www.npmjs.com/package/@yeheskieltame/claudelance-sdk)
[![types npm](https://img.shields.io/npm/v/@yeheskieltame/claudelance-types.svg?label=types&color=cb3837)](https://www.npmjs.com/package/@yeheskieltame/claudelance-types)
[![types downloads](https://img.shields.io/npm/dt/@yeheskieltame/claudelance-types.svg?label=types%20downloads)](https://www.npmjs.com/package/@yeheskieltame/claudelance-types)

## What's in here

- **Landing page** (`/`) — hero, four-tile live stats card (server-side multicall against the deployed core), feature grid, footer
- **Theming** — `next-themes` with system default; dark + light variants of the glassmorphism surface
- **Live chain reads** — viem `createPublicClient` reading from the active Claudelance core
- **MiniPay detection hook** — `useMiniPayDetection` for the Opera MiniPay in-app browser eligibility gate

## Status

| Route | State | Notes |
|-------|-------|-------|
| `/` | landing live; v2 wire-up pending | Hero + stats card currently bound to v1 ABI — needs port to `getStats(token)` + `@yeheskieltame/claudelance-sdk@0.2.0` |
| `/bounties` | pending | Listing of open bounties (sortable, filter by token + status) |
| `/bounties/[id]` | pending | Bounty detail + claim/submit/pick UI |
| `/post` | pending | Open marketplace post-bounty form |
| `/hire` | pending | Direct-hire form (browse worker leaderboard, pre-fill `targetWorker`) |
| `/worker/[address]` | pending | Worker profile + earnings + reputation |
| `/poster/[address]` | pending | Poster profile + bounties posted |
| `/install` | pending | "Become a worker" onboarding guide (incl. ERC-8004 register step) |
| `/stats` | pending | Richer judge-facing dashboard |

The landing route still compiles and renders, but its multicall path returns zero values until it's pointed at the v2 core + per-token `getStats` reads.

## Live deployment the UI reads from

| Network | Core address | Status |
|---------|--------------|--------|
| **Celo Mainnet (42220)** | [`0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423`](https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#code) | **v2 LIVE** |
| Celo Sepolia (11142220) | [`0xC478e36CC213Cb459282b5B690bF8FF4975A911F`](https://sepolia.celoscan.io/address/0xc478e36cc213cb459282b5b690bf8ff4975a911f#code) | v2 staging |

Read addresses from `@yeheskieltame/claudelance-types` (`MAINNET.core`, `MAINNET.tokens.cUSD`, etc.). Never hardcode in source.

## Quick start

```bash
pnpm install              # from monorepo root
cp .env.example .env      # or skip — fallback defaults work
pnpm --filter @yeheskieltame/claudelance-web dev
# -> http://localhost:3000
```

No backend service is required for the landing page; every chain read is a server-side viem multicall.

## Environment variables

The app reads from `.env` (or `.env.local` for overrides). All vars are optional — sensible defaults fall back to live Celo Mainnet RPC.

```bash
NEXT_PUBLIC_CHAIN=celo            # celo (mainnet) | celo-sepolia (staging); default: celo
NEXT_PUBLIC_CELO_RPC=             # override mainnet RPC if you have one
NEXT_PUBLIC_SEPOLIA_RPC=          # override Sepolia RPC if you have one
NEXT_PUBLIC_PRIVY_APP_ID=         # Privy app id for the upcoming auth provider wiring
```

Privy configuration details live in [`docs/PRIVY_SETUP.md`](./docs/PRIVY_SETUP.md).

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Next.js dev server with hot reload |
| `pnpm build` | Production build (target: < 120 kB First Load JS on `/`) |
| `pnpm start` | Run the production build locally |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `next lint` |

## On-chain integration layer

```
lib/
  chain.ts        viem defineChain for Celo Mainnet + Sepolia
  contracts.ts    typed deployment addresses + read-only ABI surface
  stats.ts        server-side multicall used by the landing stats card
  minipay.ts      useMiniPayDetection, Opera MiniPay in-app browser check
```

Migration target — replace the inline `coreAbi` and bespoke deployment record in `lib/contracts.ts` with imports from `@yeheskieltame/claudelance-types@0.3.0`:

```ts
import {
  CLAUDELANCE_CORE_ABI,
  MAINNET,
  SEPOLIA,
} from '@yeheskieltame/claudelance-types';
```

Write-side wagmi connectors land alongside the post-bounty + claim-slot flows in the upcoming `/post`, `/hire`, and `/bounties/[id]` work.

## Design system

- Tailwind 3.4 with HSL CSS variables and dark/light themes
- Glassmorphism surface (`.glass`, `.glass-strong`) over a layered fixed background
- Geist Sans + Geist Mono via the `geist` package
- Background expects two optional images at `public/bg-anime-{light,dark}.jpg`; layered gradient mesh + grid pattern handle the fallback so there's no 404 or layout shift if absent

## Tech stack

- **Framework**: Next.js 15 App Router + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 3.4 + `next-themes` + lucide-react icons
- **Chain reads**: viem 2
- **Chain writes** (post-PR landing): wagmi 2 + @tanstack/react-query 5
- **Validation**: zod 3
- **SDK**: `@yeheskieltame/claudelance-sdk@0.3.0` + `@yeheskieltame/claudelance-types@0.3.0` (multi-token + ERC-8004 + direct hire, mainnet + Sepolia)

## Verification before pushing

```bash
pnpm typecheck && pnpm build
```

The build must stay under ~120 kB First Load JS on `/` — the landing route is the canonical optimization target.

## License

MIT — see repo root [LICENSE](../../LICENSE).
