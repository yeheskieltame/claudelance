#!/usr/bin/env bash
# swarm-status.sh — diagnostic dashboard for the worker swarm.
# Prints one pipe-separated row per worker:
#   w<N> | <addr> | <celo> | <8004_nft> | <cusd_allow> | <celo_allow> | <usdc_allow>
# Env: START_IDX, END_IDX.

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SWARM="$ROOT/claudelance worker"
START=${START_IDX:-1}
END=${END_IDX:-30}

CORE=${CORE:-0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423}
CUSD=${CUSD:-0x765DE816845861e75A25fCA122bb6898B8B1282a}
CELO=${CELO:-0x471EcE3750Da237f93B8E339c536989b8978a438}
USDC=${USDC:-0xcebA9300f2b948710d2653dD7B07f33A8B32118C}
ID8004=${ID8004:-0x8004A169FB4a3325136EB29fA0ceB6D2e539a432}

cd "$ROOT/contracts"

printf "%-4s | %-42s | %-14s | %-5s | %-14s | %-14s | %-14s\n" "id" "address" "CELO" "8004" "cusd_allow" "celo_allow" "usdc_allow"
echo "------------------------------------------------------------------------------------------------------------------------------"

for i in $(seq "$START" "$END"); do
  f="$SWARM/worker $i/wallet.env"
  [ -f "$f" ] || continue
  addr=$(grep "^ADDRESS=" "$f" | cut -d= -f2)
  celobal=$(cast balance --rpc-url celo --ether "$addr" 2>/dev/null | grep -v Warning | head -1)
  nft=$(cast call --rpc-url celo "$ID8004" "balanceOf(address)(uint256)" "$addr" 2>/dev/null | head -1)
  acu=$(cast call --rpc-url celo "$CUSD" "allowance(address,address)(uint256)" "$addr" "$CORE" 2>/dev/null | head -1)
  ace=$(cast call --rpc-url celo "$CELO" "allowance(address,address)(uint256)" "$addr" "$CORE" 2>/dev/null | head -1)
  aus=$(cast call --rpc-url celo "$USDC" "allowance(address,address)(uint256)" "$addr" "$CORE" 2>/dev/null | head -1)
  fmt() {
    case "$1" in
      0) echo "0" ;;
      "115792089237316195423570985008687907853269984665640564039457584007913129639935") echo "MAX" ;;
      *) echo "${1:0:14}" ;;
    esac
  }
  printf "w%-3d | %-42s | %-14.6s | %-5s | %-14s | %-14s | %-14s\n" "$i" "$addr" "${celobal:-?}" "${nft:-?}" "$(fmt "${acu:-0}")" "$(fmt "${ace:-0}")" "$(fmt "${aus:-0}")"
done
