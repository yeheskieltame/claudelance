/**
 * Filtered, paginated bounty reads for ClaudelanceCoreV3. Kept out of the
 * client class so it composes cleanly. Filters run client-side after one
 * multicall batch: fine at hackathon scale, no indexer needed.
 */

import { type PublicClient, type Address } from 'viem';
import {
  CLAUDELANCE_CORE_V3_ABI,
  BountyStatus,
  type Bounty,
} from '@yeheskieltame/claudelance-types';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type ListBountiesOptions = {
  /**
   * Filter by status. Use 'all' to include every status.
   * Defaults to BountyStatus.Open (0).
   */
  status?: BountyStatus | 'all';
  /** Filter by escrow token address. */
  token?: Address;
  /** Filter by task type (0-10 for canonical types). */
  bountyType?: number;
  /** Filter by poster address. */
  poster?: Address;
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Number of items per page (1-100). Defaults to 20. */
  pageSize?: number;
};

export type BountyWithId = Bounty & { id: bigint };

export type BountyPage = {
  items: BountyWithId[];
  /** Total bounties matching the filter (across all pages). */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Return a paginated, filtered list of bounties from a v3 contract.
 *
 * @param publicClient  viem PublicClient connected to the right network.
 * @param core          v3 proxy address.
 * @param maxId         Highest bounty ID to scan. Pass the result of
 *                      `client.getBountyCountV3()` or a known upper bound.
 * @param opts          Filter and pagination options.
 */
export async function listBounties(
  publicClient: PublicClient,
  core: Address,
  maxId: bigint,
  opts: ListBountiesOptions = {},
): Promise<BountyPage> {
  if (maxId === 0n) return { items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, hasMore: false };

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const statusFilter = opts.status ?? BountyStatus.Open;

  // Fetch all bounties in one multicall.
  const calls = [];
  for (let i = 1n; i <= maxId; i++) {
    calls.push({
      address: core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'getBounty' as const,
      args: [i] as const,
    });
  }

  const results = await publicClient.multicall({
    contracts: calls,
    allowFailure: true,
  });

  // Apply filters.
  const matched: BountyWithId[] = [];
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx];
    if (!r || r.status === 'failure') continue;
    const b = r.result as Bounty;
    if (!b || (b as { poster?: string }).poster === ZERO_ADDRESS) continue;

    if (statusFilter !== 'all' && b.status !== statusFilter) continue;
    if (opts.token && b.token.toLowerCase() !== opts.token.toLowerCase()) continue;
    if (opts.bountyType !== undefined && b.bountyType !== opts.bountyType) continue;
    if (opts.poster && (b as { poster?: string }).poster?.toLowerCase() !== opts.poster.toLowerCase()) continue;

    matched.push({ ...(b as Bounty), id: BigInt(idx + 1) });
  }

  const total = matched.length;
  const start = (page - 1) * pageSize;
  const items = matched.slice(start, start + pageSize);

  return { items, total, page, pageSize, hasMore: start + pageSize < total };
}

/**
 * Convenience: list open bounties for a specific task type across all tokens.
 */
export async function listOpenBountiesByType(
  publicClient: PublicClient,
  core: Address,
  maxId: bigint,
  bountyType: number,
  opts?: Omit<ListBountiesOptions, 'status' | 'bountyType'>,
): Promise<BountyPage> {
  return listBounties(publicClient, core, maxId, {
    ...opts,
    status: BountyStatus.Open,
    bountyType,
  });
}

/**
 * Convenience: list all bounties posted by a specific address.
 */
export async function listBountiesByPoster(
  publicClient: PublicClient,
  core: Address,
  maxId: bigint,
  poster: Address,
  opts?: Omit<ListBountiesOptions, 'poster'>,
): Promise<BountyPage> {
  return listBounties(publicClient, core, maxId, { ...opts, poster });
}

/**
 * Convenience: list all bounties where a worker could be the target
 * (either open marketplace OR direct-hire targeting this worker).
 */
export async function listClaimableByWorker(
  publicClient: PublicClient,
  core: Address,
  maxId: bigint,
  worker: Address,
  opts?: Omit<ListBountiesOptions, 'status'>,
): Promise<BountyWithId[]> {
  const page = await listBounties(publicClient, core, maxId, {
    ...opts,
    status: BountyStatus.Open,
    pageSize: MAX_PAGE_SIZE,
  });
  const workerLower = worker.toLowerCase();
  return page.items.filter((b) => {
    const tw = ((b as unknown as { targetWorker?: string }).targetWorker ?? '').toLowerCase();
    return tw === ZERO_ADDRESS || tw === workerLower;
  });
}
