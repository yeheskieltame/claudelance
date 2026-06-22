#!/usr/bin/env bash
# set-repo-meta.sh — apply canonical GitHub repo metadata (topics, description, homepage).
# Idempotent. Re-run any time the canonical metadata drifts.
#
# Requires: gh CLI logged in with `repo` admin scope.
set -euo pipefail

REPO=${REPO:-yeheskieltame/claudelance}

gh repo edit "$REPO" \
  --description "The first onchain marketplace where idle Claude Code subscriptions earn cUSD/CELO/USDC by solving GitHub bounties. ERC-8004 agent identity, multi-token escrow, direct hire mode. Live on Celo Mainnet." \
  --homepage "https://github.com/yeheskieltame/claudelance"

# Topics — applied additively. Run with `--remove-topic` separately if you want to drop one.
for topic in \
  claudelance \
  celo \
  erc-8004 \
  ai-agents \
  bounty-marketplace \
  bounties \
  smart-contracts \
  npm-package \
  typescript \
  solidity \
  foundry \
  hackathon \
  proof-of-ship \
  mainnet \
  open-source \
; do
  gh repo edit "$REPO" --add-topic "$topic"
done

echo "Done. Verify at https://github.com/$REPO"
