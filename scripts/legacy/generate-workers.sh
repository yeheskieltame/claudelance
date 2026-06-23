#!/usr/bin/env bash
# generate-workers.sh — bulk-generate worker wallets into the gitignored swarm folder.
# Idempotent: skips any worker whose wallet.env already exists.
#
# Env: START_IDX (default 1), END_IDX (default 12).
# Writes per worker: claudelance worker/worker <N>/wallet.env (chmod 600).
# Also appends to claudelance worker/wallets.md as an index row.

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SWARM="$ROOT/claudelance worker"
INDEX="$SWARM/wallets.md"
START=${START_IDX:-1}
END=${END_IDX:-12}

mkdir -p "$SWARM"
if [ ! -f "$INDEX" ]; then
  {
    echo "# Claudelance worker swarm wallets"
    echo ""
    echo "Local-only — parent folder is gitignored."
    echo ""
    echo "| Worker | Address | Wallet file |"
    echo "|--------|---------|-------------|"
  } > "$INDEX"
fi

for i in $(seq "$START" "$END"); do
  folder="$SWARM/worker $i"
  mkdir -p "$folder"
  if [ -f "$folder/wallet.env" ]; then
    echo "w$i: exists, skip"
    continue
  fi
  json=$(cast wallet new --json)
  addr=$(echo "$json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["address"])')
  pk=$(echo "$json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["private_key"])')
  {
    printf "# Claudelance worker %d wallet\n" "$i"
    printf "# Generated %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf "# Local-only: never commit (parent folder gitignored)\n"
    printf "WORKER_ID=%d\nADDRESS=%s\nPRIVATE_KEY=%s\n" "$i" "$addr" "$pk"
  } > "$folder/wallet.env"
  chmod 600 "$folder/wallet.env"
  echo "w$i: $addr"
  echo "| $i | \`$addr\` | \`worker $i/wallet.env\` |" >> "$INDEX"
done
