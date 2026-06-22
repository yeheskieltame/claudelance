#!/usr/bin/env bash
# BINGOChain bounty lifecycle batch — dogfood the Claudelance MAINNET v3 proxy on
# real external-product work. Each row is "worker:PR[:type]" and maps a MERGED
# BINGOChain PR to one on-chain direct-hire bounty:
#
#   dh-post (deployer funds worker gas + postDirectHire on mainnet v3)
#     -> worker run.mjs work (claim slot + submitDeliverable = the PR URL)
#       -> dh-finish (pickWinner -> Railway keeper settleStake + attestReputation)
#
# Lifecycles run SEQUENTIALLY (deployer nonce + forno replica lag), exactly like
# scripts/lifecycle-batch.sh. The deliverable is real product code on BINGOChain;
# poster + worker are both operator wallets, so this is operator DOGFOODING — never
# label it organic third-party adoption (see Claudelance CLAUDE.md).
#
# Usage:
#   bash scripts/bingo-lifecycle-batch.sh 1:1 2:2 3:3 4:4
#   AMOUNT=0.5 STAKE=0.02 FUND=0.2 WATCH_MIN=5 bash scripts/bingo-lifecycle-batch.sh 1:1:0
#
# Env overrides (defaults tuned cheap for a proof run):
#   AMOUNT     bounty reward in CELO        (default 0.5)
#   STAKE      worker stake in CELO         (default 0.02)
#   FUND       worker gas floor in CELO     (default 0.2)
#   DAYS       deadline in days             (default 3)
#   WATCH_MIN  keeper watch window minutes  (default 5)
#   TYPE       default task type            (default 0 = Code)
set -uo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
export NODE_OPTIONS=''

REPO="https://github.com/yeheskieltame/BINGOChain"
AMOUNT="${AMOUNT:-0.5}"
STAKE="${STAKE:-0.02}"
FUND="${FUND:-0.2}"
DAYS="${DAYS:-3}"
WATCH_MIN="${WATCH_MIN:-5}"
DEFAULT_TYPE="${TYPE:-0}"
SUMMARY=""

echo "BINGOChain bounty batch -> Claudelance MAINNET v3 ($REPO)"
echo "amount=$AMOUNT stake=$STAKE fund=$FUND days=$DAYS watch=${WATCH_MIN}m default-type=$DEFAULT_TYPE"
echo "rows: $*"
echo "---------------------------------------------------------------"

for row in "$@"; do
  W="${row%%:*}"               # worker number
  rest="${row#*:}"
  PR="${rest%%:*}"             # BINGOChain PR number
  TYPE="${rest#*:}"            # optional type; falls back to default
  [ "$TYPE" = "$rest" ] && TYPE="$DEFAULT_TYPE"
  ISSUE="$REPO/pull/$PR"
  echo "=== lifecycle: worker $W -> BINGOChain PR #$PR (type $TYPE) ==="

  # Post (retry: forno replicas lag the deployer's prior nonce).
  BID=""
  for post_try in 1 2 3 4 5; do
    POST_OUT=$(node scripts/dh-post.mjs --worker "$W" --issue "$ISSUE" --repo "$REPO" \
      --amount "$AMOUNT" --stake "$STAKE" --type "$TYPE" --days "$DAYS" --fund "$FUND" 2>&1)
    BID=$(echo "$POST_OUT" | grep -oE 'bountyId=[0-9]+' | head -1 | cut -d= -f2)
    if [ -n "$BID" ]; then echo "$POST_OUT" | grep -E 'funded|posted'; break; fi
    echo "w$W PR#$PR: post attempt $post_try failed, retrying in 12s"
    sleep 12
  done
  if [ -z "$BID" ]; then
    echo "w$W PR#$PR: POST FAILED after retries, skipping"
    SUMMARY="$SUMMARY\nPR#$PR w$W: POST FAILED"
    continue
  fi

  # Worker side: deliverable hash = keccak256(issueUrl), deliverable = PR URL.
  HASH=$(cd "claudelance worker/worker $W" && \
    node -e "const {keccak256,toBytes}=require('viem');console.log(keccak256(toBytes(process.argv[1])))" "$ISSUE")
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

  # Tail: pickWinner, then watch the keeper close settleStake + attestReputation.
  FIN_OUT=$(node scripts/dh-finish.mjs --bounty "$BID" --worker "$W" --watch-min "$WATCH_MIN" 2>&1)
  echo "$FIN_OUT" | grep -E "pickWinner|settleStake|attestReputation|did NOT" | tail -4
  SUMMARY="$SUMMARY\nPR#$PR bounty$BID w$W: resolved"
done

echo "========== BINGO BATCH SUMMARY =========="
echo -e "$SUMMARY"
