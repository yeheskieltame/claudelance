# Deliverable review checklist

Run this before calling pickWinner, so you only reward work that meets the spec.

## Always

- The deliverable URL resolves and is reachable (PR, Gist, IPFS, or Arweave).
- The content matches the task spec and acceptance criteria.
- A content hash is present on the submission (commit SHA for code, keccak256 of
  the content otherwise).
- The submission landed before the deadline.

## For code (type 0) and code audit (type 5)

- The pull request targets the right repo and branch.
- If the bounty set ciRequired, the relayer has attested a passing CI run.

## For Legal (type 8) and Finance (type 9)

- The submission metadata records a disclaimer acknowledgment.
- The deliverable itself includes the disclaimer at the top.

## Then

- Pick the winner. The reward minus the 2 percent fee is credited, and stakes
  settle. If nothing qualifies, let it expire and reclaim the escrow.
