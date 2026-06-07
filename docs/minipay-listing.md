# MiniPay Listing — Submission Prep

Working reference for submitting Claudelance to the MiniPay Discover page.

- Submission form: <https://developer.minipay.to/mini-app-listing>
- Docs: <https://docs.minipay.xyz/getting-started/submit-your-miniapp.html>
- Production app: <https://claudelance.xyz> (Celo Mainnet, chain 42220)

## Status

| Item | Status |
|------|--------|
| Live on Celo Mainnet (contract verified on Celoscan) | Done |
| HTTPS production URL | Done |
| Auto-connect, no separate connect button in MiniPay | Done (PR #317) |
| Mainnet-only web app (Sepolia removed) | Done (PR #317) |
| MiniPay fee abstraction — `feeCurrency` on all writes | Done |
| Mobile responsive (min viewport 360x720) | Done (loads in MiniPay dev mode) |
| Terms of Service page (in-app) | Done — `/terms` (PR #319) |
| Privacy Policy page (in-app) | Done — `/privacy` (PR #319) |
| Support URL (in-app) | Done — footer Support link → `mailto:support@claudelance.xyz` |
| Icon 512x512 | Done — `/icon-512.png` |
| App name / tagline / publisher / category | Done — draft below |
| Network manifest | Done — below |
| Sample transaction links | Done — below |
| PageSpeed Insights score | Pending — run at pagespeed.web.dev (Mobile tab) |
| Screenshots | Pending — capture from MiniPay |

## 1. Listing fields

| Field | Value |
|-------|-------|
| App Name | Claudelance |
| Tagline | The onchain bounty marketplace where idle AI coding agents earn cUSD, CELO, or USDC on Celo by solving real GitHub issues. |
| Tagline (alt) | Got Claude Code? Earn cUSD, CELO, or USDC while it sleeps — onchain on Celo. |
| Publisher | Claudelance (yeheskieltame) |
| Category | developer-tools (alt: finance) |
| App URL | https://claudelance.xyz |
| Icon (512x512) | https://claudelance.xyz/icon-512.png |
| Support URL | mailto:support@claudelance.xyz |
| Support email | support@claudelance.xyz |
| Terms of Service | https://claudelance.xyz/terms |
| Privacy Policy | https://claudelance.xyz/privacy |

## 2. Technical prerequisites

- Wallet auto-connects via the injected MiniPay provider; the connect button is hidden inside MiniPay (`window.ethereum.isMiniPay`). See `MiniPayAutoConnect` in `apps/web/components/minipay-auto-connect.tsx` and the early return in `wallet-button-core.tsx`.
- Served over HTTPS (Vercel).
- Responsive, mobile-first layout (bottom nav, safe-area insets); minimum viewport 360x720 supported.
- Targets Celo Mainnet only (chain 42220). `DEFAULT_CHAIN_ID` is a hardcoded constant.
- Gas: every write transaction explicitly sets `feeCurrency` to cUSD when running inside MiniPay (Celo fee abstraction / CIP-64), so users holding no native CELO can still transact. Helper: `apps/web/lib/wallet/fee-currency.ts`; applied to `post-bounty-page.tsx` (approve, postBounty) and `bounty-detail.tsx` (claimSlot, submitPR, pickWinner, settleStake, withdrawEarnings). Outside MiniPay the field is omitted and gas is paid in native CELO.
- Contract source verified on Celoscan.

## 3. Network manifest

Origins the app connects to at runtime (allow-list these):

- `https://claudelance.xyz` — app origin and same-origin API routes: `/api/bounties`, `/api/bounty/[id]`, `/api/stats`, `/api/worker/[address]`, `/api/swarm`, `/api/health`, `/api/agent/manifest`
- `https://forno.celo.org` — Celo Mainnet JSON-RPC (all chain reads and transaction broadcast)
- `https://api.coingecko.com` — CELO/USD price (server-side, `apps/web/lib/price.ts`)
- `https://auth.privy.io` and `*.privy.io` — optional Privy sign-in (only when a user logs in with GitHub, email, or an external wallet)
- MiniPay injected provider — in-app, no external origin

Outbound navigation links (no in-app data sent):

- `https://celoscan.io` — block explorer (tx/address links)
- `https://github.com` — repository, issue, and PR links
- `https://celo.org` — Proof of Ship link (footer)
- `https://www.npmjs.com`, `https://bundlephobia.com` — package badges/links on `/docs`

Hosting: Vercel. Fonts (Geist + Bricolage Grotesque, via `next/font`) and images are self-hosted — no external font or image CDN at runtime.

## 4. Sample transactions

Contract: <https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423>

User-facing lifecycle methods:

| Method | Sample transaction |
|--------|--------------------|
| postBounty | https://celoscan.io/tx/0x3484cead885b5bef3c26ea52370fdf3c5250feb0721869267b39bdbfa2d9b0fa |
| postDirectHire | https://celoscan.io/tx/0x0045a1f21e502f78299b5063a1d20127ca0338573f22df1ab9694f0298de815e |
| claimSlot | https://celoscan.io/tx/0xf0aa04cf297ea9708c8a8c740b9e8cc316bb3c3987ce6a382877c346ed9e193e |
| submitPR | https://celoscan.io/tx/0xf9043034e4a37d43e59ee40e2db7cdca6302a13766ee5f87722ea5b863f121c0 |
| pickWinner | https://celoscan.io/tx/0xcde099049f8cc4f89ae51d0fa8376d3d6a7ed5b545a563527b2e894eec2a437a |
| withdrawEarnings | https://celoscan.io/tx/0x768a2d21472a4cda21b71288c6bc7cfc3f5553f1c7f352137aac6c4adda77f33 |
| settleStake | https://celoscan.io/tx/0x16a3ee9a7295234748a971ad797e2028f7d79a29f789203f5d9b97d586ce7061 |

Not user-facing:

- Deployment (verified): https://celoscan.io/tx/0x8c7f6b28f3a422200a55509e7825af5d5f1f753728431d313fb52558207420c5
- `allowToken` / `setMinBounty` / treasury rotation / `pause` — owner-only via the Safe multisig (`0xe9Fc48f315fD4E989637fAcC29AaF2717E19f7F0`); execute as zero-value internal calls, not in the standard txlist.
- `attestCI` — relayer-only (`0x1fEDda23c2945D59f3929e6C463cF685aC077ad5`), automated; not exercised on recent direct-hire bounties (`ciRequired=false`).
- `approve` — standard ERC20 method on the token contract (cUSD/CELO/USDC), not the Claudelance core.

463 total transactions to the contract; all 7 user-facing methods are proven on-chain.

## 5. Pending (manual)

- **PageSpeed Insights** — run <https://pagespeed.web.dev/?url=https://claudelance.xyz>, record the Mobile score.
- **Screenshots** — capture from MiniPay (landing, bounties list, bounty detail, post flow).

## 6. Testing inside MiniPay (dev mode)

1. MiniPay > Settings > About > tap Version repeatedly until confirmed.
2. Settings > Developer Settings > enable Developer Mode.
3. Keep Use Testnet OFF (the app is mainnet-only).
4. Load Test Page > enter `https://claudelance.xyz` > Go.

## 7. Review flow

Submit > MiniPay internal testing > feedback > approval > listed on Discover. After listing, critical issues must be fixed within 24 hours or the listing is temporarily disabled.
