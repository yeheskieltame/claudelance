/**
 * Lifecycle states for an on-chain bounty.
 * Mirrors `enum BountyStatus` in the contract - exactly three states.
 *
 * There is no on-chain "Expired" state: an unresolved bounty past its
 * deadline stays `Open` until `cancelExpired` flips it to `Cancelled`.
 * Derive "expired" from `status === Open && deadline <= now`.
 */
export enum BountyStatus {
  Open = 0,
  Resolved = 1,
  Cancelled = 2,
}

/**
 * On-chain bounty record. Mirrors `struct Bounty` in `IClaudelanceCore.sol` (v2).
 *
 * `token` is the ERC20 used for escrow (cUSD / CELO / USDC etc - admin whitelist).
 * `targetWorker` is `0x00…` for open marketplace bounties; non-zero means
 * direct-hire (only that address can claim).
 *
 * Numeric fields use `bigint` because they originate from Solidity uint96 / uint64
 * and may exceed `Number.MAX_SAFE_INTEGER`.
 */
export type Bounty = {
  poster: `0x${string}`;
  amount: bigint;
  winner: `0x${string}`;
  stakeRequired: bigint;
  token: `0x${string}`;
  deadline: bigint;
  maxSlots: number;
  claimedSlots: number;
  bountyType: number;
  ciRequired: boolean;
  targetWorker: `0x${string}`;
  status: BountyStatus;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash: `0x${string}`;
};

/** Helper: a bounty is open-marketplace iff its `targetWorker` is the zero address. */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export function isDirectHire(bounty: Pick<Bounty, 'targetWorker'>): boolean {
  return bounty.targetWorker.toLowerCase() !== ZERO_ADDRESS;
}
