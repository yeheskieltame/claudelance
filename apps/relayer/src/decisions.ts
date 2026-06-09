import { BountyStatus, type Bounty, type Submission } from '@yeheskieltame/claudelance-sdk';

/** Mirrors `RESOLUTION_GRACE_PERIOD` in ClaudelanceCoreV3. */
export const GRACE_PERIOD_SECONDS = 3n * 24n * 60n * 60n;

export type KeeperAction =
  | { kind: 'settleStake'; bountyId: bigint; worker: `0x${string}` }
  | { kind: 'cancelExpired'; bountyId: bigint }
  | { kind: 'attestReputation'; bountyId: bigint; winner: `0x${string}` };

export type ClaimerState = {
  worker: `0x${string}`;
  /** The contract's "stake already settled" flag (refund OR forfeit). */
  stakeSettled: boolean;
};

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

/**
 * Decide which permissionless keeper calls a bounty needs right now. Pure:
 * same inputs always produce the same actions. Each branch mirrors an
 * on-chain guard so the keeper never queues a call that would revert.
 */
export function decideKeeperActions(
  bountyId: bigint,
  bounty: Pick<Bounty, 'status' | 'deadline' | 'stakeRequired' | 'winner'>,
  claimers: ClaimerState[],
  nowSeconds: bigint,
  reputationAttested: boolean,
  graceSeconds: bigint = GRACE_PERIOD_SECONDS,
): KeeperAction[] {
  if (bounty.status === BountyStatus.Open) {
    // Before deadline+grace only the poster may cancel; after, anyone (incl. the keeper).
    if (nowSeconds >= bounty.deadline + graceSeconds) {
      return [{ kind: 'cancelExpired', bountyId }];
    }
    return [];
  }

  const actions: KeeperAction[] = [];

  // Resolved or Cancelled: sweep every stake still locked in the contract.
  if (
    (bounty.status === BountyStatus.Resolved || bounty.status === BountyStatus.Cancelled) &&
    bounty.stakeRequired > 0n
  ) {
    for (const c of claimers) {
      if (!c.stakeSettled) actions.push({ kind: 'settleStake', bountyId, worker: c.worker });
    }
  }

  // Resolved: write the winner's ERC-8004 reputation once (v3.1 attestReputation).
  if (
    bounty.status === BountyStatus.Resolved &&
    !reputationAttested &&
    bounty.winner.toLowerCase() !== ZERO_ADDR
  ) {
    actions.push({ kind: 'attestReputation', bountyId, winner: bounty.winner });
  }

  return actions;
}

/** Map a CI run conclusion to a pass/fail verdict, or null when it isn't terminal. */
export function ciPassedFromConclusion(conclusion: string | null | undefined): boolean | null {
  switch (conclusion) {
    case 'success':
      return true;
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
      return false;
    default:
      // cancelled / skipped / neutral / stale / action_required / null (in-progress)
      return null;
  }
}

export type AttestContext = {
  bountyId: bigint;
  worker: `0x${string}`;
  bountyStatus: BountyStatus;
  ciRequired: boolean;
  /** v3 task-type gate. undefined = unknown (treated as supported); false = skip. */
  ciSupported?: boolean;
};

export type AttestAction = {
  kind: 'attestCI';
  bountyId: bigint;
  worker: `0x${string}`;
  passed: boolean;
};

/**
 * Decide whether a CI conclusion should produce an on-chain attestation.
 * Returns null when attesting would be pointless (bounty not open, CI not
 * required, task type does not support CI) or premature (no terminal verdict).
 */
export function decideAttest(
  conclusion: string | null | undefined,
  ctx: AttestContext,
): AttestAction | null {
  if (ctx.bountyStatus !== BountyStatus.Open) return null;
  if (!ctx.ciRequired) return null;
  if (ctx.ciSupported === false) return null;
  const passed = ciPassedFromConclusion(conclusion);
  if (passed === null) return null;
  return { kind: 'attestCI', bountyId: ctx.bountyId, worker: ctx.worker, passed };
}

/** Fields of a DeliverableSubmitted log the CI matcher reads. */
export type DeliverableRef = {
  deliverableUrl: string;
  deliverableHash: string;
};

/** Normalize a GitHub PR URL for comparison (trim, lowercase, drop trailing slash). */
export function normalizeDeliverableUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Right-pad a git commit SHA into a bytes32 value, the fallback `deliverableHash`
 * convention for a worker who stores the commit SHA rather than a keccak256 of
 * the deliverable content.
 */
export function padCommitHash(sha: string): `0x${string}` {
  const hex = sha.replace(/^0x/, '').toLowerCase();
  return `0x${hex.padEnd(64, '0').slice(0, 64)}`;
}

/**
 * Decide whether an on-chain deliverable belongs to a CI run. The deliverable
 * URL is the reliable join key: a code worker stores the PR html URL verbatim,
 * and `deliverableHash` is worker-chosen (keccak256 of content OR a padded
 * commit SHA), so it is only a fallback for the padded-SHA convention.
 */
export function deliverableMatchesCi(
  ref: DeliverableRef,
  prUrls: string[],
  headSha: string,
): boolean {
  const url = normalizeDeliverableUrl(ref.deliverableUrl);
  if (url !== '' && prUrls.some((u) => normalizeDeliverableUrl(u) === url)) return true;
  return ref.deliverableHash.toLowerCase() === padCommitHash(headSha);
}

/** True when an already-stored submission's CI verdict differs from the new one. */
export function shouldReattest(submission: Pick<Submission, 'ciPassed'>, passed: boolean): boolean {
  return submission.ciPassed !== passed;
}
