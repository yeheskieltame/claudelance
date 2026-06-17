# Play-to-Earn Bounty Template

> The cross-city loop of the Lance economy: a **Claudelance** bounty that rewards
> **$LANCE** for **playing BingoChain**. Play games → submit on-chain proof →
> get paid $LANCE → redeem to CELO or play more.
>
> Status: operator dogfooding (all wallets operator-controlled). This is the
> template + validated mechanism, not organic adoption.

## The loop
```
1. POST    operator posts a Claudelance direct-hire bounty, reward in $LANCE,
           spec = "play N BingoChain arenas staking $LANCE; submit the settle tx hashes"
2. PLAY    player plays N BingoChain arenas in $LANCE (UI, or scripts/play-mainnet.mjs
           with STAKE_TOKEN=$LANCE) → collects N `ArenaSettled` tx hashes
3. SUBMIT  player claimSlot (stakes $LANCE) + submitDeliverable(proofUrl, hash)
           proofUrl = the settle tx hashes (Celoscan links / gist / JSON)
4. SETTLE  poster pickWinner → keeper settleStake (returns the $LANCE stake) +
           attestReputation (+1 ERC-8004) → player withdraws the $LANCE reward
```
Every step is real on-chain activity across BingoChain + Claudelance + the Lance Hub.

## Contracts
- Claudelance v3 (bounty): `0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8`
- BingoChain (the game): `0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1`
- $LANCE / Lance Hub (reward + redeem): `0xb70c9Cd73428Afe51eEEA832C49E8840D3f85cA2`
- $LANCE whitelisted on Claudelance (minBounty 10 LANCE) and BingoChain (minStake 10 LANCE).

## Bounty parameters
- **token**: $LANCE
- **bountyType**: 10 (Custom) - it's not a code task
- **amount (reward)**: e.g. 100 $LANCE
- **stake**: small $LANCE (e.g. 5) - Claudelance requires stake > 0; returned to the player on settle
- **instructionUrl**: a spec page describing the task + the required proof format
- **targetRepoUrl**: the BingoChain repo (informational)

## Proof format (the deliverable)
The player submits `submitDeliverable(deliverableUrl, deliverableHash)` where:
- `deliverableUrl` - a public reference to the **N BingoChain `ArenaSettled` tx hashes**
  the player participated in (a gist, a JSON, or concatenated Celoscan tx links).
- `deliverableHash` - `keccak256(deliverableUrl)`.

### Verification (what the poster checks before pickWinner)
1. Each tx is a real `settle(arenaId)` on the BingoChain contract.
2. The arena's token is $LANCE and it reached `Settled`.
3. The player's address is among the arena's players (`getPlayers(arenaId)`).
4. There are at least N distinct such arenas.

## How to run (dogfood)
1. **Post**: `node scripts/pte-post.mjs --worker N --reward 100 --stake 5 --games 2 --proof <specUrl>`
   (funds the worker's gas + $LANCE stake, then posts the $LANCE bounty; prints `bountyId`).
2. **Play**: from `Bingo-chain/`, `STAKE_TOKEN=0xb70c9C… STAKE_AMOUNT=10 GAS_FLOOR=0.5 node scripts/play-mainnet.mjs wave 2`
   (or play in the UI). Collect the `ArenaSettled` tx hashes from `scripts/out/results-*.json`.
3. **Submit**: `cd "claudelance worker/worker N" && node run.mjs work <bountyId> <proofUrl> <keccak(proofUrl)>`
   (mints identity if needed, approves $LANCE, claimSlot, submitDeliverable).
4. **Finish**: `node scripts/dh-finish.mjs --bounty <bountyId> --worker N` → pickWinner +
   keeper settleStake + attestReputation → worker withdraws the $LANCE reward.

## Batch (many workers at once)
`node scripts/pte-batch.mjs --workers 5,6,7 [--reward 30] [--stake 5]` runs the full
loop (post → submit proof → finish → withdraw) for each worker sequentially,
reusing the single-step scripts. Proofs are drawn from real BingoChain $LANCE
`ArenaSettled` txs. Validated: workers 5/6/7 each earned ~29.4 net $LANCE
(bounties #142/#143/#144), withdrawn via the patched run.mjs. Use it to scale
play-to-earn activity (more bounties + $LANCE flow) during the dev phase.

## Economic effect
- Players acquire $LANCE (buy at the Hub or earn via these bounties) → demand.
- $LANCE-denominated game fees + Claudelance fees feed the value engine (Phase B: route fees → `fundPool` / burn) → NAV rises for all holders.
- Reward $LANCE is redeemable at the Hub for CELO (minus 1% fee) → trust.

## Honesty
All wallets are operator-controlled → operator dogfooding. Proof txs are real games,
but this is the mechanism running, not third-party adoption. Never label otherwise.
