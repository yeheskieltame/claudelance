# Security policy

## Supported surfaces

| Surface | Where | Supported |
|---|---|---|
| `ClaudelanceCore` v2 | Celo mainnet `0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423` | yes |
| `ClaudelanceCore` v2 | Celo Sepolia `0xC478e36CC213Cb459282b5B690bF8FF4975A911F` | yes |
| `@yeheskieltame/claudelance-sdk` | npmjs.com latest | yes |
| `@yeheskieltame/claudelance-types` | npmjs.com latest | yes |
| Frontend (`apps/web`) | latest deployed build | yes |
| Earlier mainnet at `0x775d4278…` (v1) | superseded, no traffic | no |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email **yeheskielyunustame13@gmail.com** with:

- A clear description of the vulnerability
- A reproduction recipe (transactions, payloads, code snippets)
- The surface affected and an estimate of severity / impact
- Your name and any contact info you want credited

We'll acknowledge within 48 hours, agree on a fix timeline, and coordinate a
disclosure window. Mainnet contracts are immutable; if a vulnerability
requires a contract migration, we'll publish a migration plan alongside the
fix.

## Scope

In scope: all source under this repo and the mirror repos `claudelance-sdk` /
`claudelance-types`; the deployed contracts listed above; the npm packages
listed above.

Out of scope: third-party RPC endpoints, MiniPay itself, MetaMask / Privy
connectors, Celoscan, ERC-8004 registries (`0x8004…`).

## Hall of thanks

(empty - be the first)
