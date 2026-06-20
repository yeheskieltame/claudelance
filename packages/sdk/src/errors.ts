/**
 * Typed error hierarchy for @yeheskieltame/claudelance-sdk.
 *
 * All errors extend ClaudelanceError so callers can catch the base class:
 *   try { ... } catch (e) { if (e instanceof ClaudelanceError) { ... } }
 *
 * On-chain revert strings are normalised into typed classes so consumers
 * don't have to parse raw viem error messages.
 */

export type ClaudelanceErrorContext = {
  /** Bounty ID involved in the failed operation, if known. */
  bountyId?: bigint;
  /** Transaction hash that reverted, if the tx was broadcast. */
  tx?: `0x${string}`;
  /** Original viem / RPC error that caused this. */
  cause?: unknown;
};

/** Base class for all Claudelance SDK errors. */
export class ClaudelanceError extends Error {
  override readonly name: string = 'ClaudelanceError';
  readonly bountyId?: bigint;
  readonly tx?: `0x${string}`;
  override readonly cause?: unknown;

  constructor(message: string, ctx?: ClaudelanceErrorContext) {
    super(message, ctx?.cause !== undefined ? { cause: ctx.cause } : undefined);
    // Restore prototype chain for instanceof checks in transpiled environments.
    Object.setPrototypeOf(this, new.target.prototype);
    this.bountyId = ctx?.bountyId;
    this.tx = ctx?.tx;
  }
}

/** Wallet balance < amount + stake needed for the operation. */
export class InsufficientFundsError extends ClaudelanceError {
  readonly token: string;
  readonly required: bigint;
  readonly available: bigint;

  constructor(token: string, required: bigint, available: bigint, ctx?: ClaudelanceErrorContext) {
    super(
      `Insufficient ${token}: need ${required}, have ${available}`,
      ctx,
    );
    this.token = token;
    this.required = required;
    this.available = available;
  }
}

/** claimSlot reverted: wallet already claimed a slot on this bounty. */
export class AlreadyClaimedError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Already claimed a slot on bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''}`,
      ctx,
    );
  }
}

/** claimSlot reverted: bounty is direct-hire and caller is not the target worker. */
export class NotTargetWorkerError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Not the target worker for bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''}`,
      ctx,
    );
  }
}

/** claimSlot reverted: wallet has no ERC-8004 Identity NFT. */
export class NoAgentIdentityError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      'Wallet does not hold an ERC-8004 Identity NFT - call ensureIdentity() first',
      ctx,
    );
  }
}

/** withdrawEarnings reverted: no pending earnings for the given token. */
export class NothingToWithdrawError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super('No pending earnings for this token', ctx);
  }
}

/** Operation requires bounty status = Open, but it is Resolved or Cancelled. */
export class BountyNotOpenError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''} is not open`,
      ctx,
    );
  }
}

/** Operation rejected because the bounty deadline has passed. */
export class DeadlinePassedError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''} deadline has passed`,
      ctx,
    );
  }
}

/** postBounty/postDirectHire: requested bountyType is not enabled on v3. */
export class TaskTypeNotEnabledError extends ClaudelanceError {
  readonly typeId: number;

  constructor(typeId: number, ctx?: ClaudelanceErrorContext) {
    super(`Task type ${typeId} is not enabled on this contract`, ctx);
    this.typeId = typeId;
  }
}

/** Token is not whitelisted on the contract (allowToken not called). */
export class TokenNotAllowedError extends ClaudelanceError {
  readonly token: string;

  constructor(token: string, ctx?: ClaudelanceErrorContext) {
    super(`Token ${token} is not whitelisted - call allowToken() via owner`, ctx);
    this.token = token;
  }
}

/** submitDeliverable: deliverable has already been submitted for this bounty. */
export class AlreadySubmittedError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Deliverable already submitted for bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''}`,
      ctx,
    );
  }
}

/** pickWinner failed: no submission from the chosen worker, or CI not passed. */
export class WinnerInvalidError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Winner is invalid for bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''} - check submission and CI status`,
      ctx,
    );
  }
}

/** claimSlot reverted: every slot on this bounty is already taken. */
export class SlotsFullError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `All slots are full on bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''}`,
      ctx,
    );
  }
}

/** submit/settleStake reverted: caller never claimed a slot on this bounty. */
export class NotClaimerError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Caller has not claimed a slot on bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''}`,
      ctx,
    );
  }
}

/** pickWinner reverted: the chosen worker has no submission. */
export class NoSubmissionError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `No submission from the chosen worker on bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''}`,
      ctx,
    );
  }
}

/** pickWinner/cancelExpired reverted: caller is not the bounty poster. */
export class NotPosterError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super(
      `Caller is not the poster of bounty${ctx?.bountyId !== undefined ? ` #${ctx.bountyId}` : ''}`,
      ctx,
    );
  }
}

/**
 * A state-changing call reverted because the contract is paused (OZ Pausable,
 * `EnforcedPause`). Only `withdrawEarnings` stays callable while paused.
 * Check {@link ClaudelanceClient.isPaused} before broadcasting.
 */
export class ContractPausedError extends ClaudelanceError {
  constructor(ctx?: ClaudelanceErrorContext) {
    super('Contract is paused - only withdrawEarnings is callable', ctx);
  }
}

// Revert-string to typed-error mapping.

const REVERT_MAP: Array<[RegExp, (ctx: ClaudelanceErrorContext) => ClaudelanceError]> = [
  [/EnforcedPause/i,        (c) => new ContractPausedError(c)],
  [/AlreadyClaimed/i,       (c) => new AlreadyClaimedError(c)],
  [/SlotsFull/i,            (c) => new SlotsFullError(c)],
  [/NotTargetedWorker/i,    (c) => new NotTargetWorkerError(c)],
  [/NoAgentIdentity/i,      (c) => new NoAgentIdentityError(c)],
  [/NothingToWithdraw/i,    (c) => new NothingToWithdrawError(c)],
  [/BountyNotOpen/i,        (c) => new BountyNotOpenError(c)],
  [/DeadlinePassed/i,       (c) => new DeadlinePassedError(c)],
  [/TaskTypeNotEnabled/i,   (c) => new TaskTypeNotEnabledError(-1, c)],
  [/TokenNotAllowed/i,      (c) => new TokenNotAllowedError('unknown', c)],
  [/AlreadySubmitted/i,     (c) => new AlreadySubmittedError(c)],
  [/NoSubmission/i,         (c) => new NoSubmissionError(c)],
  [/NotClaimer/i,           (c) => new NotClaimerError(c)],
  [/NotPoster/i,            (c) => new NotPosterError(c)],
  [/WinnerInvalid/i,        (c) => new WinnerInvalidError(c)],
];

/**
 * Attempt to parse a viem ContractFunctionRevertedError (or any error with a
 * `.message` or nested `.cause.message`) into a typed ClaudelanceError.
 * Returns the original error unchanged if no pattern matches.
 */
export function parseContractError(
  err: unknown,
  ctx?: ClaudelanceErrorContext,
): ClaudelanceError | unknown {
  const msg =
    (err instanceof Error ? err.message : '') +
    (err instanceof Error && err.cause instanceof Error ? ' ' + err.cause.message : '');

  for (const [pattern, factory] of REVERT_MAP) {
    if (pattern.test(msg)) {
      return factory({ cause: err, ...ctx });
    }
  }
  return err;
}

/**
 * Same as {@link parseContractError} but always throws.
 * Use inside catch blocks:
 *   catch (err) { throwTyped(err, { bountyId }); }
 */
export function throwTyped(err: unknown, ctx?: ClaudelanceErrorContext): never {
  throw parseContractError(err, ctx);
}
