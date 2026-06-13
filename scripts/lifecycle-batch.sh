#!/usr/bin/env bash
# Run a sequence of full direct-hire lifecycles, one PR per bounty, fully
# resolving each before the next (per the sequential-bounty rule). Each row is
# "worker:prNumber". Maps a merged frontend PR to an on-chain bounty.
# Usage: bash scripts/lifecycle-batch.sh 2:561 3:562 4:563 ...
set -uo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
export NODE_OPTIONS=''
REPO="https://github.com/yeheskieltame/claudelance"
SUMMARY=""

for pair in "$@"; do
  W="${pair%%:*}"
  PR="${pair##*:}"
  ISSUE="$REPO/pull/$PR"
  echo "=== lifecycle: worker $W -> PR #$PR ==="

  POST_OUT=$(node scripts/dh-post.mjs --worker "$W" --issue "$ISSUE" --repo "$REPO" --amount 1 --stake 0.05 --type 0 --days 3 --fund 0.3 2>&1)
  echo "$POST_OUT"
  BID=$(echo "$POST_OUT" | grep -oE 'bountyId=[0-9]+' | head -1 | cut -d= -f2)
  if [ -z "$BID" ]; then
    echo "w$W PR#$PR: POST FAILED, skipping"
    SUMMARY="$SUMMARY\nPR#$PR w$W: POST FAILED"
    continue
  fi

  HASH=$(cd "claudelance worker/worker $W" && node -e "const {keccak256,toBytes}=require('viem');console.log(keccak256(toBytes(process.argv[1])))" "$ISSUE")
  # Forno replicas lag a freshly-posted bounty; the worker loop crashes if it
  # claims before the bounty is visible. Retry the work step a few times.
  WORK_OK=""
  for attempt in 1 2 3 4; do
    sleep 8
    WORK_OUT=$(cd "claudelance worker/worker $W" && node run.mjs work "$BID" "$ISSUE" "$HASH" 2>&1)
    if echo "$WORK_OUT" | grep -q '"submitTx"'; then WORK_OK=1; break; fi
    echo "w$W bounty$BID: work attempt $attempt failed, retrying"
  done
  echo "$WORK_OUT" | tail -1
  if [ -z "$WORK_OK" ]; then
    echo "w$W bounty$BID: WORK FAILED after retries"
    SUMMARY="$SUMMARY\nPR#$PR bounty$BID w$W: WORK FAILED"
    continue
  fi

  FIN_OUT=$(node scripts/dh-finish.mjs --bounty "$BID" --worker "$W" --watch-min 5 2>&1)
  echo "$FIN_OUT" | grep -E "pickWinner|settleStake|attestReputation|did NOT" | tail -4
  SUMMARY="$SUMMARY\nPR#$PR bounty$BID w$W: resolved"
done

echo "========== BATCH SUMMARY =========="
echo -e "$SUMMARY"
