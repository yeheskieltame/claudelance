import { TASK_TYPE_NAMES, type Bounty } from '@yeheskieltame/claudelance-types';

/**
 * Convert a token wei amount (bigint) to a plain number for UI / log lines.
 * Precision is lossy beyond ~15 decimal digits: fine for human display,
 * NEVER use the result for math that affects on-chain state.
 */
export function tokenToFloat(wei: bigint, decimals = 18): number {
  return Number(wei) / 10 ** decimals;
}

/**
 * Convert a human-readable amount (float) to wei (bigint).
 *
 * Rounds at the wei boundary. Caller is responsible for sanity-checking
 * the result against the contract's per-token `minBounty`.
 */
export function floatToToken(amount: number, decimals = 18): bigint {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`[floatToToken] amount must be a non-negative finite number, got ${amount}`);
  }
  return BigInt(Math.round(amount * 10 ** decimals));
}

/**
 * Pretty-print a token amount with symbol + decimals.
 *
 *   tokenFormat(2_060_000_000_000_000_000n, 'cUSD')        -> "2.06 cUSD"
 *   tokenFormat(123_456_789n, 'USDC', { decimals: 6 })     -> "123.46 USDC"
 */
export function tokenFormat(
  wei: bigint,
  symbol: string,
  opts: { decimals?: number; places?: number } = {}
): string {
  const { decimals = 18, places = 2 } = opts;
  return `${tokenToFloat(wei, decimals).toFixed(places)} ${symbol}`;
}

/** Back-compat: convenience wrappers for the cUSD case (18 decimals). */
export const cusdToFloat = (wei: bigint): number => tokenToFloat(wei, 18);
export const floatToCusd = (amount: number): bigint => floatToToken(amount, 18);
export const cusdFormat = (wei: bigint, places = 2): string => tokenFormat(wei, 'cUSD', { places });

/**
 * Seconds until a bounty's deadline. Can be negative if already passed.
 */
export function timeRemaining(bounty: Bounty, nowSeconds?: number): number {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  return Number(bounty.deadline) - now;
}

/**
 * One-line, agent-friendly summary of a bounty for log lines + LLM prompts.
 * The token amount is rendered in token's smallest unit if a symbol/decimals
 * are not provided (sane default: assume 18 decimals).
 */
export function formatBountySummary(
  bounty: Bounty & { id: bigint },
  opts: { tokenSymbol?: string; tokenDecimals?: number } = {}
): string {
  const { tokenSymbol = 'token', tokenDecimals = 18 } = opts;
  const statusLabel = ['OPEN', 'RESOLVED', 'CANCELLED'][bounty.status] ?? '?';
  const remaining = timeRemaining(bounty);
  const days = Math.max(0, Math.floor(remaining / 86_400));
  const hours = Math.max(0, Math.floor((remaining % 86_400) / 3600));
  const left = remaining <= 0 ? 'EXPIRED' : `${days}d ${hours}h left`;
  const ci = bounty.ciRequired ? 'CI required' : 'no CI';
  const ZERO = '0x0000000000000000000000000000000000000000';
  const mode = bounty.targetWorker.toLowerCase() === ZERO ? 'OPEN' : `DIRECT->${bounty.targetWorker.slice(0, 8)}`;
  const typeLabel = TASK_TYPE_NAMES[bounty.bountyType as keyof typeof TASK_TYPE_NAMES] ?? `type${bounty.bountyType}`;
  return [
    `Bounty #${bounty.id} ${statusLabel}`,
    typeLabel,
    mode,
    tokenFormat(bounty.amount, tokenSymbol, { decimals: tokenDecimals }),
    `${bounty.claimedSlots}/${bounty.maxSlots} slots`,
    left,
    ci,
    `spec: ${bounty.instructionUrl || bounty.targetRepoUrl}`,
  ].join(' | ');
}
