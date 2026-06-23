#!/usr/bin/env bash
# fund-workers.sh — send native CELO from MAINNET_DEPLOYER_PRIVATE_KEY to a range of workers.
# Env: START_IDX, END_IDX, AMOUNT_WEI (default 0.2 CELO = 200000000000000000).
# Requires: MAINNET_DEPLOYER_PRIVATE_KEY in env, foundry's `celo` RPC alias (run from contracts/).

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SWARM="$ROOT/claudelance worker"
START=${START_IDX:-1}
END=${END_IDX:-12}
AMOUNT=${AMOUNT_WEI:-200000000000000000}

: "${MAINNET_DEPLOYER_PRIVATE_KEY:?MAINNET_DEPLOYER_PRIVATE_KEY env var required}"

cd "$ROOT/contracts"

for i in $(seq "$START" "$END"); do
  f="$SWARM/worker $i/wallet.env"
  [ -f "$f" ] || { echo "w$i: wallet.env missing, skip"; continue; }
  addr=$(grep "^ADDRESS=" "$f" | cut -d= -f2)
  hash=""
  for try in 1 2 3; do
    hash=$(cast send --rpc-url celo --private-key "$MAINNET_DEPLOYER_PRIVATE_KEY" --value "$AMOUNT" "$addr" 2>&1 | grep "^transactionHash" | awk '{print $2}')
    [ -n "$hash" ] && break
    sleep 5
  done
  echo "w$i: fund $addr -> ${hash:-FAIL}"
  sleep 1
done
