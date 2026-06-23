#!/usr/bin/env bash
# register-workers.sh — bulk-call ERC-8004 register() from each worker's own key.
# Idempotent: skips workers whose balanceOf > 0.
# Env: START_IDX, END_IDX.

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SWARM="$ROOT/claudelance worker"
START=${START_IDX:-1}
END=${END_IDX:-12}
ID8004=${ID8004:-0x8004A169FB4a3325136EB29fA0ceB6D2e539a432}

cd "$ROOT/contracts"

for i in $(seq "$START" "$END"); do
  f="$SWARM/worker $i/wallet.env"
  [ -f "$f" ] || { echo "w$i: wallet.env missing, skip"; continue; }
  addr=$(grep "^ADDRESS=" "$f" | cut -d= -f2)
  pk=$(grep "^PRIVATE_KEY=" "$f" | cut -d= -f2)
  bal=$(cast call --rpc-url celo "$ID8004" "balanceOf(address)(uint256)" "$addr" 2>/dev/null | head -1)
  if [ "${bal:-0}" != "0" ]; then
    echo "w$i: already registered (NFT bal=$bal), skip"
    continue
  fi
  hash=""
  for try in 1 2 3; do
    hash=$(cast send --rpc-url celo --private-key "$pk" "$ID8004" "register()" 2>&1 | grep "^transactionHash" | awk '{print $2}')
    [ -n "$hash" ] && break
    sleep 5
  done
  echo "w$i: register $addr -> ${hash:-FAIL}"
  sleep 1
done
