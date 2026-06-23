#!/usr/bin/env bash
# approve-workers.sh — bulk approve cUSD/CELO/USDC to Core from each worker's own key.
# Idempotent: skips token if current allowance already >= 2**128.
# Env: START_IDX, END_IDX, TOKENS (comma-separated subset of cUSD,CELO,USDC; default all).

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SWARM="$ROOT/claudelance worker"
START=${START_IDX:-1}
END=${END_IDX:-12}
TOKENS_ARG=${TOKENS:-cUSD,CELO,USDC}

CORE=${CORE:-0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423}
CUSD=${CUSD:-0x765DE816845861e75A25fCA122bb6898B8B1282a}
CELO=${CELO:-0x471EcE3750Da237f93B8E339c536989b8978a438}
USDC=${USDC:-0xcebA9300f2b948710d2653dD7B07f33A8B32118C}
MAX=0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
THRESHOLD=0x80000000000000000000000000000000

cd "$ROOT/contracts"

addr_for_sym() {
  case "$1" in
    cUSD) echo "$CUSD" ;;
    CELO) echo "$CELO" ;;
    USDC) echo "$USDC" ;;
    *) echo ""; return 1 ;;
  esac
}

for i in $(seq "$START" "$END"); do
  f="$SWARM/worker $i/wallet.env"
  [ -f "$f" ] || { echo "w$i: wallet.env missing, skip"; continue; }
  addr=$(grep "^ADDRESS=" "$f" | cut -d= -f2)
  pk=$(grep "^PRIVATE_KEY=" "$f" | cut -d= -f2)
  IFS=',' read -ra TOKEN_LIST <<< "$TOKENS_ARG"
  for sym in "${TOKEN_LIST[@]}"; do
    token=$(addr_for_sym "$sym") || { echo "unknown token $sym"; continue; }
    cur=$(cast call --rpc-url celo "$token" "allowance(address,address)(uint256)" "$addr" "$CORE" 2>/dev/null | head -1)
    cur_dec=$(cast --to-dec "${cur:-0}" 2>/dev/null || echo 0)
    threshold_dec=$(cast --to-dec "$THRESHOLD" 2>/dev/null || echo 0)
    if [ "${cur_dec:-0}" -ge "${threshold_dec:-0}" ] 2>/dev/null; then
      echo "w$i: $sym already approved, skip"
      continue
    fi
    hash=""
    for try in 1 2 3; do
      hash=$(cast send --rpc-url celo --private-key "$pk" "$token" "approve(address,uint256)" "$CORE" "$MAX" 2>&1 | grep "^transactionHash" | awk '{print $2}')
      [ -n "$hash" ] && break
      sleep 5
    done
    echo "w$i: approve $sym -> ${hash:-FAIL}"
    sleep 1
  done
done
