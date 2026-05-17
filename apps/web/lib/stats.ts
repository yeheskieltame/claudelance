import { createPublicClient, http, type Address } from "viem";

import { CLAUDELANCE_CORE_ABI } from "@yeheskieltame/claudelance-types";

import { celoSepolia, celoMainnet, DEFAULT_CHAIN_ID, chainById } from "./chain";
import { getDeployment } from "./contracts";
import { tokenToUsd, type SupportedToken } from "./usd-conversion";

/**
 * Per-token stats returned by the v2 `getStats(token)` view function.
 */
type PerTokenStats = {
  volume: bigint;
  revenue: bigint;
  resolved: bigint;
  posters: bigint;
  workers: bigint;
};

/**
 * Aggregated live statistics across all three whitelisted tokens.
 */
export type LiveStats = {
  bountyCount: bigint;
  totalVolumeUsd: number;
  totalRevenueUsd: number;
  totalResolved: bigint;
  uniquePosters: bigint;
  uniqueWorkers: bigint;
  feeBps: bigint;
  perToken: Record<SupportedToken, PerTokenStats>;
};

const rpcOverrides: Partial<Record<number, string>> = {
  [celoSepolia.id]: process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC,
  [celoMainnet.id]: process.env.NEXT_PUBLIC_CELO_MAINNET_RPC,
};

/**
 * Server-side multicall that reads `bountyCount`, `PROTOCOL_FEE_BPS`, and
 * `getStats(token)` for each of the three whitelisted tokens from the live v2
 * ClaudelanceCore contract. One RPC round-trip, 5 results.
 */
export async function fetchLiveStats(chainId: number = DEFAULT_CHAIN_ID): Promise<LiveStats> {
  const chain = chainById(chainId);
  if (!chain) throw new Error(`Unsupported chain id ${chainId}`);
  const rpc = rpcOverrides[chainId] ?? chain.rpcUrls.default.http[0];
  const client = createPublicClient({ chain, transport: http(rpc) });
  const deploy = getDeployment(chainId);

  const tokens = deploy.tokens;

  const reads = await client.multicall({
    contracts: [
      { address: deploy.core, abi: CLAUDELANCE_CORE_ABI, functionName: "bountyCount" },
      { address: deploy.core, abi: CLAUDELANCE_CORE_ABI, functionName: "PROTOCOL_FEE_BPS" },
      makeStatsRead(deploy.core, tokens.cUSD),
      makeStatsRead(deploy.core, tokens.CELO),
      makeStatsRead(deploy.core, tokens.USDC),
    ],
    allowFailure: false,
  });

  const bountyCount = reads[0] as bigint;
  const feeBps = reads[1] as bigint;

  const cusdStats = parseStats(reads[2] as readonly [bigint, bigint, bigint, bigint, bigint]);
  const celoStats = parseStats(reads[3] as readonly [bigint, bigint, bigint, bigint, bigint]);
  const usdcStats = parseStats(reads[4] as readonly [bigint, bigint, bigint, bigint, bigint]);

  const totalVolumeUsd =
    tokenToUsd("cUSD", cusdStats.volume) +
    tokenToUsd("CELO", celoStats.volume) +
    tokenToUsd("USDC", usdcStats.volume);

  const totalRevenueUsd =
    tokenToUsd("cUSD", cusdStats.revenue) +
    tokenToUsd("CELO", celoStats.revenue) +
    tokenToUsd("USDC", usdcStats.revenue);

  // These counters are global (not per-token) so we take the max across tokens.
  // In practice the contract stores them globally but getStats returns them per-token call;
  // the values are the same regardless of which token is passed.
  const totalResolved = maxBigInt(cusdStats.resolved, celoStats.resolved, usdcStats.resolved);
  const uniquePosters = maxBigInt(cusdStats.posters, celoStats.posters, usdcStats.posters);
  const uniqueWorkers = maxBigInt(cusdStats.workers, celoStats.workers, usdcStats.workers);

  return {
    bountyCount,
    totalVolumeUsd,
    totalRevenueUsd,
    totalResolved,
    uniquePosters,
    uniqueWorkers,
    feeBps,
    perToken: {
      cUSD: cusdStats,
      CELO: celoStats,
      USDC: usdcStats,
    },
  };
}

function makeStatsRead(core: Address, token: Address) {
  return {
    address: core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: "getStats" as const,
    args: [token] as const,
  };
}

function parseStats(result: readonly [bigint, bigint, bigint, bigint, bigint]): PerTokenStats {
  return {
    volume: result[0],
    revenue: result[1],
    resolved: result[2],
    posters: result[3],
    workers: result[4],
  };
}

function maxBigInt(...values: bigint[]): bigint {
  return values.reduce((a, b) => (a > b ? a : b), 0n);
}
