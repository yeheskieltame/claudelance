/**
 * Worker submission for a bounty (v3). Mirrors `struct Submission` in
 * `ClaudelanceCoreV3.sol`. One per (bountyId, worker) - submitDeliverable is one-shot.
 *
 * v3 field renames from v2:
 *   prUrl        → deliverableUrl   (any URL, not just GitHub PRs)
 *   commitHash   → deliverableHash  (keccak256 of any content)
 *   stakeRefunded → stakeSettled    (whether settleStake has run)
 */
export type Submission = {
  /** keccak256 of the deliverable content (or commit SHA padded to bytes32). */
  deliverableHash: `0x${string}`;
  /** Unix timestamp when the deliverable was submitted. 0n = not yet submitted. */
  submittedAt: bigint;
  /** True if the relayer attested CI passed (or ciRequired is false). */
  ciPassed: boolean;
  /** True if settleStake has already been called for this worker. */
  stakeSettled: boolean;
  /** Deliverable URL: GitHub PR, Gist, IPFS CID, Arweave TX, or custom. */
  deliverableUrl: string;
  /** Free-form JSON metadata attached at submit time. */
  metadata: string;
};
