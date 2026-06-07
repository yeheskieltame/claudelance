/**
 * Human-readable mirrors of the on-chain constants. The contract is the
 * source of truth. Per-token values like minBounty are not constants; read
 * them at runtime via getStats(token).
 */

/** Protocol fee in basis points (200 = 2%). */
export const PROTOCOL_FEE_BPS = 200 as const;
export const BPS_DENOMINATOR = 10_000 as const;

/** Maximum claimers per open-marketplace bounty. */
export const MAX_SLOTS = 20 as const;

/** Bounty deadline bounds (in seconds). */
export const MIN_DEADLINE_SECONDS = 86_400 as const; // 1 day
export const MAX_DEADLINE_SECONDS = 1_209_600 as const; // 14 days

/** Grace period after deadline during which only the poster may cancel. */
export const RESOLUTION_GRACE_PERIOD_SECONDS = 259_200 as const; // 3 days

/** Mandatory delay between proposing a treasury/relayer rotation and applying it. */
export const ADMIN_TIMELOCK_SECONDS = 172_800 as const; // 2 days

/** After this many seconds past `effectiveAt`, a pending rotation expires. */
export const PROPOSAL_VALIDITY_WINDOW_SECONDS = 1_209_600 as const; // 14 days

/** Bounty tier guidance for code tasks (type 0). Denominated in cUSD. */
export const BOUNTY_TIERS = {
  tiny: { minCusd: 0.5, maxCusd: 1, label: 'Tiny — typo / README' },
  small: { minCusd: 1, maxCusd: 3, label: 'Small — bug fix / test' },
  medium: { minCusd: 3, maxCusd: 8, label: 'Medium — feature / refactor' },
  large: { minCusd: 8, maxCusd: 20, label: 'Large — multi-file change' },
} as const;

/**
 * Suggested bounty ranges per task type (v3). Denominated in cUSD.
 * These are UI hints — the contract only enforces per-token minBounty.
 */
export const TASK_TYPE_TIERS = {
  0: { minCusd: 0.5, maxCusd: 20, label: 'Code' },
  1: { minCusd: 2, maxCusd: 15, label: 'Data Analysis' },
  2: { minCusd: 3, maxCusd: 20, label: 'Research' },
  3: { minCusd: 1, maxCusd: 10, label: 'Content' },
  4: { minCusd: 1, maxCusd: 8, label: 'Doc Review' },
  5: { minCusd: 5, maxCusd: 30, label: 'Code Audit' },
  6: { minCusd: 1, maxCusd: 10, label: 'Translation' },
  7: { minCusd: 2, maxCusd: 15, label: 'Education' },
  8: { minCusd: 5, maxCusd: 50, label: 'Legal — disclaimer required' },
  9: { minCusd: 5, maxCusd: 50, label: 'Finance — disclaimer required' },
  10: { minCusd: 0.5, maxCusd: 50, label: 'Custom' },
} as const satisfies Record<number, { minCusd: number; maxCusd: number; label: string }>;

/** Deliverable URL format hints per task type (for UI/worker guidance). */
export const TASK_TYPE_DELIVERABLE_HINT = {
  0: 'GitHub PR URL (https://github.com/owner/repo/pull/N)',
  1: 'GitHub Gist or IPFS URL with dataset + analysis notebook',
  2: 'GitHub Gist, IPFS, or Arweave URL with research report (Markdown/PDF)',
  3: 'GitHub Gist or IPFS URL with content draft',
  4: 'GitHub PR or Gist with reviewed document and comments',
  5: 'GitHub Gist or IPFS URL with audit report (Markdown)',
  6: 'GitHub Gist or IPFS URL with translated content',
  7: 'GitHub Gist, IPFS, or Arweave URL with tutorial/course material',
  8: 'GitHub Gist or IPFS URL with legal analysis — disclaimer ack required',
  9: 'GitHub Gist or IPFS URL with financial analysis — disclaimer ack required',
  10: 'Any verifiable URL matching the poster-specified format',
} as const satisfies Record<number, string>;
