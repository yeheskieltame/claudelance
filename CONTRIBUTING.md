# Contributing

Thanks for taking a look. Claudelance is a hackathon project (Celo Proof of
Ship #8) that runs an onchain bounty marketplace, so contributions take three
shapes depending on what you're touching.

## TL;DR

| You want to… | Read |
|---|---|
| Earn on a real bounty | [Worker flow](#worker-flow) |
| Patch a bug / add a feature | [Maintainer flow](#maintainer-flow) |
| Report a security issue | [SECURITY.md](SECURITY.md) |

## Worker flow

All bounties are **direct-hire only** as of 2026-05-17. Public `bounty-open`
issues are not posted - bounty issues are informational, the on-chain
`postDirectHire` call is the source of truth.

If you've been targeted as the worker for a bounty:

1. Hold an ERC-8004 Identity NFT (Celo mainnet
   `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) on the address that received
   the direct hire.
2. Call `claimSlot(bountyId)` on the core contract.
3. Open a PR on the target repo. The PR body MUST include:

   ```
   Closes #<issue>
   Claudelance Bounty: #<id>
   Agent: claudelance-worker-#<id>
   ```

4. Call `submitPR(bountyId, prUrl)` once the PR is open.
5. Wait for the CI relayer to attest, then for the poster to call `pickWinner`.
6. Pull your earnings via `withdrawEarnings(token)`.

If you self-submitted a PR to a direct-hire bounty you weren't targeted for,
we'll close it politely and offer a future direct-hire slot if the PR is
high quality. Don't be discouraged.

## Maintainer flow

Non-bounty contributions follow the standard fork-PR loop.

1. Fork or branch from `main`. Naming: `kiel-dev/<area>/<topic>` for the
   primary maintainer; any descriptive name for forks.
2. Make focused commits. Per-file commits are preferred over kitchen-sink
   commits.
3. Run the relevant test suite:

   ```bash
   # contracts
   pnpm test:contracts
   # everything else
   pnpm -r run test
   ```

4. For contracts: `slither contracts/src/ClaudelanceCore.sol` must come back
   clean. Mainnet contracts are immutable - security review gating is strict.
5. Open a PR using the template. Self-review is fine for hackathon scope.
6. CI must pass before merge.

### Style

- TypeScript / Solidity / Rust files: respect existing formatters
  (Prettier / `forge fmt` / rustfmt).
- Comments: only when WHY is non-obvious. Don't paraphrase code.
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`,
  `docs:`, `ci:`, etc.). Subject under 72 chars. Body wrapped at 80.
- English for code, comments, commits. Bahasa is fine in chat / issues.

## Releasing npm packages

`@yeheskieltame/claudelance-sdk` + `-types` publish from CI on a tag. npm
`latest` only reflects what was tagged - a feature merged to `main` is **not**
on npm until the next release, so release promptly after merging a consumer-
facing change.

1. Bump the changed package's `version` (its own commit, e.g. `chore(sdk): release 0.4.8`).
2. Merge to `main`.
3. Tag and push: `git tag pkg-v<semver> && git push origin pkg-v<semver>`
   (the semver must match the package.json version). This fires
   `.github/workflows/publish-npm.yml` → npmjs + GitHub Packages.
4. The workflow's final step verifies the version is live on npm; **also
   verify the artifact contents** for a consumer-facing change:

   ```bash
   npm pack <name>@<semver> && tar xzf *.tgz && grep <expected-export> package/dist/index.js
   ```

   (We shipped `0.4.3` without the `ClaudelanceClient.address` getter because
   it was tagged before the getter merged - a tarball check would have caught it.)

## Local setup

```bash
git clone https://github.com/yeheskieltame/claudelance.git
cd claudelance
pnpm install
pnpm build
```

Contracts are under `contracts/` (Foundry); see `contracts/README.md` for
forge install + deploy notes.

## What we won't accept

- Feature flags or backwards-compatibility shims for code that hasn't
  shipped to mainnet yet.
- New abstractions without a concrete second caller.
- Emoji / decorative checkmarks in code, comments, commit messages, or
  PR descriptions.
- Test mocks for the database or contract interactions - we use real
  Anvil / Sepolia for integration testing.
- PRs that bypass pre-commit hooks (`--no-verify`).
