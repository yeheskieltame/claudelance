#!/usr/bin/env bash
# Dogfood the audit work as on-chain v3 direct-hire bounties, one per fix, to the
# local validation agents. Per bounty: dh-post -> worker run -> pickWinner ->
# withdraw -> sweep CELO back to the poster (recycle). Hard-stops on any
# post/work/finish failure so a problem never silently burns the budget.
# Usage: bash scripts/audit-bounties.sh [START] [END]
ROOT="/Users/kiel/Documents/Hacathon/celo-pos/Claudelance"
cd "$ROOT" || exit 1
LOG="scripts/.audit-bounties.log"
BINGO="https://github.com/yeheskieltame/BINGOChain"
CL="https://github.com/yeheskieltame/claudelance"
PR145="$BINGO/pull/145"
PR626="$CL/pull/626"

# worker | repo | prUrl | label
LIST=(
"1|$BINGO|$PR145|referral-sybil-hardening"
"2|$BINGO|$PR145|cancelled-leaderboard-fix"
"3|$BINGO|$PR145|public-get-write-amp-fix"
"4|$BINGO|$PR145|arena-jsonparse-crash-guard"
"5|$BINGO|$PR145|referral-payout-double-pay-stop"
"6|$BINGO|$PR145|cors-indexer-deadcode-cleanup"
"7|$CL|$PR626|webhook-admin-gate"
"8|$CL|$PR626|review-reputation-cap"
"9|$CL|$PR626|relayer-signer-lock"
"10|$CL|$PR626|relayer-rpc-defaults"
"11|$CL|$PR626|goals-nplus1-rolegates-cycle"
"12|$CL|$PR626|sdk-agentid-and-errors"
"13|$CL|$PR626|burst-wave-nonce-and-scripts"
"14|$CL|$PR626|sdk-v2-removal"
"15|$CL|$PR626|sepolia-mainnet-only"
"16|$CL|$PR626|frontend-skill-mcp-v3-only"
)

START="${1:-1}"; END="${2:-16}"
HASH_OF(){ node -e "const {createRequire}=require('module');const r=createRequire('$ROOT/packages/sdk/package.json');const {keccak256,toBytes}=r('viem');process.stdout.write(keccak256(toBytes(process.argv[1])))" "$1"; }

for i in $(seq "$START" "$END"); do
  IFS='|' read -r W REPO PRURL LABEL <<< "${LIST[$((i-1))]}"
  echo "" | tee -a "$LOG"
  echo "===== FIX $i  worker=$W  label=$LABEL  $(date -u +%H:%M:%S) =====" | tee -a "$LOG"

  OUT=$(node scripts/dh-post.mjs --worker "$W" --issue "$PRURL" --repo "$REPO" --fund 0.6 2>&1); rc=$?
  echo "$OUT" | tee -a "$LOG"
  [ $rc -ne 0 ] && { echo "ABORT: dh-post failed at fix $i" | tee -a "$LOG"; exit 1; }
  BID=$(echo "$OUT" | grep -oE "bountyId=[0-9]+" | head -1 | cut -d= -f2)
  [ -z "$BID" ] && { echo "ABORT: no bountyId at fix $i" | tee -a "$LOG"; exit 1; }

  HASH=$(HASH_OF "$PRURL")
  ( cd "claudelance worker/worker $W" && node run.mjs work "$BID" "$PRURL" "$HASH" ) 2>&1 | tee -a "$LOG"
  [ "${PIPESTATUS[0]}" -ne 0 ] && { echo "ABORT: worker run failed fix $i bounty=$BID" | tee -a "$LOG"; exit 1; }

  node scripts/dh-finish.mjs --bounty "$BID" --worker "$W" --watch-min 1 2>&1 | tee -a "$LOG"
  [ "${PIPESTATUS[0]}" -ne 0 ] && { echo "ABORT: dh-finish failed fix $i bounty=$BID" | tee -a "$LOG"; exit 1; }

  # Recover + recycle (non-fatal: funds remain claimable later if these blip).
  ( cd "claudelance worker/worker $W" && node run.mjs withdraw ) 2>&1 | tee -a "$LOG" || echo "WARN: withdraw fix $i" | tee -a "$LOG"
  node scripts/sweep-to-poster.mjs --worker "$W" 2>&1 | tee -a "$LOG" || echo "WARN: sweep fix $i" | tee -a "$LOG"

  echo "OK FIX $i bounty=$BID label=$LABEL" | tee -a "$LOG"
done
echo "===== ALL DONE $START-$END =====" | tee -a "$LOG"
