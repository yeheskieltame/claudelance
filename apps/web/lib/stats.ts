import { createPublicClient, formatUnits, http } from "viem";

import {
  CLAUDELANCE_CORE_ABI,
  CLAUDELANCE_CORE_V3_ABI,
  MAINNET_V2,
} from "@yeheskieltame/claudelance-types";
import { DEFAULT_CHAIN_ID, chainById } from "./chain";
import { getDeployment } from "./contracts";

// On-chain constants (v2 + v3 both use these values).
const PROTOCOL_FEE_BPS = 200n; // 2%
const RESOLUTION_GRACE_PERIOD_SECONDS = 259_200n; // 3 days
import { getCeloUsdPrice, tokenToCeloWei } from "./price";

export type LiveStats = {
  bountyCount: bigint;
  totalBountyVolume: bigint;
  totalProtocolRevenue: bigint;
  totalBountiesResolved: bigint;
  uniquePosterCount: bigint;
  uniqueWorkerCount: bigint;
  feeBps: bigint;
  graceSeconds: bigint;
  /// Per-token raw volumes (wei, native decimals).
  volumeByToken: {
    cUSD: bigint;
    CELO: bigint;
    USDC: bigint;
  };
  /// Cross-token volume expressed in CELO wei, computed via the CELO/USD oracle.
  /// cUSD and USDC are treated as $1 stablecoins, then converted at the live rate.
  totalVolumeInCelo: bigint;
  celoUsdPrice: number;
  /// Cross-token volume in USD: CELO at the live rate + cUSD/USDC at $1.
  totalVolumeUsd: number;
};

const rpcOverrides: Partial<Record<number, string>> = {
  42_220: process.env.NEXT_PUBLIC_CELO_MAINNET_RPC,
};

export async function fetchLiveStats(chainId: number = DEFAULT_CHAIN_ID): Promise<LiveStats> {
  const chain = chainById(chainId);
  if (!chain) throw new Error(`Unsupported chain id ${chainId}`);
  const rpc = rpcOverrides[chainId] ?? chain.rpcUrls.default.http[0];
  const client = createPublicClient({ chain, transport: http(rpc) });
  const deploy = getDeployment(chainId);

  // Activity lives on BOTH mainnet contracts: the immutable v2 core (code-bounty
  // era) and the v3 UUPS proxy (task types). Volume / revenue / resolved /
  // bountyCount are additive across them; unique poster/worker counts are NOT
  // (the same wallets act on both), so those take the per-contract max.
  // v3 stats come from getStatsV3(token); v2 still has its public getters.
  const isMainnet = chainId === 42_220;
  const v2Core = MAINNET_V2.core;
  const statsResults = await client.multicall({
    contracts: [
      { address: deploy.core, abi: CLAUDELANCE_CORE_V3_ABI, functionName: "getStatsV3" as const, args: [deploy.cUSD] },
      { address: deploy.core, abi: CLAUDELANCE_CORE_V3_ABI, functionName: "getStatsV3" as const, args: [deploy.CELO] },
      { address: deploy.core, abi: CLAUDELANCE_CORE_V3_ABI, functionName: "getStatsV3" as const, args: [deploy.USDC] },
      ...(isMainnet
        ? [
            { address: v2Core, abi: CLAUDELANCE_CORE_ABI, functionName: "getStats" as const, args: [deploy.cUSD] },
            { address: v2Core, abi: CLAUDELANCE_CORE_ABI, functionName: "getStats" as const, args: [deploy.CELO] },
            { address: v2Core, abi: CLAUDELANCE_CORE_ABI, functionName: "getStats" as const, args: [deploy.USDC] },
            { address: v2Core, abi: CLAUDELANCE_CORE_ABI, functionName: "bountyCount" as const, args: [] },
          ]
        : []),
    ],
    allowFailure: true,
  });

  type StatsV3Tuple = readonly [bigint, bigint, bigint, bigint, bigint, readonly bigint[]];
  const safeStats = (i: number): StatsV3Tuple => {
    const r = statsResults[i];
    if (!r || r.status === "failure") return [0n, 0n, 0n, 0n, 0n, new Array(11).fill(0n) as bigint[]];
    return r.result as StatsV3Tuple;
  };

  const [sCusd, sCelo, sUsdc] = [safeStats(0), safeStats(1), safeStats(2)];

  // v2 getStats returns the same 5 leading fields (no countByType).
  type StatsV2Tuple = readonly [bigint, bigint, bigint, bigint, bigint];
  const safeV2 = (i: number): StatsV2Tuple => {
    const r = statsResults[i];
    if (!r || r.status === "failure") return [0n, 0n, 0n, 0n, 0n];
    return r.result as StatsV2Tuple;
  };
  const ZERO5: StatsV2Tuple = [0n, 0n, 0n, 0n, 0n];
  const [vCusd, vCelo, vUsdc] = isMainnet
    ? [safeV2(3), safeV2(4), safeV2(5)]
    : [ZERO5, ZERO5, ZERO5];
  const v2BountyCountRead = isMainnet ? statsResults[6] : undefined;
  const v2BountyCount =
    v2BountyCountRead && v2BountyCountRead.status === "success"
      ? (v2BountyCountRead.result as bigint)
      : 0n;

  // Index: 0=volume, 1=revenue, 2=resolved, 3=posters, 4=workers
  const volCusd = sCusd[0] + vCusd[0];
  const volCelo = sCelo[0] + vCelo[0];
  const volUsdc = sUsdc[0] + vUsdc[0];
  const revCusd = sCusd[1] + vCusd[1];
  const revCelo = sCelo[1] + vCelo[1];
  const revUsdc = sUsdc[1] + vUsdc[1];
  // resolved/posters/workers are global per contract (same for all tokens).
  const totalBountiesResolved = sCusd[2] + vCusd[2];
  const max = (a: bigint, b: bigint) => (a > b ? a : b);
  const uniquePosterCount = max(sCusd[3], vCusd[3]);
  const uniqueWorkerCount = max(sCusd[4], vCusd[4]);
  // v3 has no bountyCount getter; its resolved count is the conservative proxy.
  const bountyCount = v2BountyCount + sCusd[2];
  // Protocol fee and grace period are constants — read from SDK rather than on-chain.
  const feeBps = PROTOCOL_FEE_BPS;
  const graceSeconds = RESOLUTION_GRACE_PERIOD_SECONDS;

  const celoUsdPrice = await getCeloUsdPrice();
  const cusdInCelo = tokenToCeloWei(volCusd, 18, 1, celoUsdPrice);
  const usdcInCelo = tokenToCeloWei(volUsdc, 6, 1, celoUsdPrice);
  const totalVolumeInCelo = volCelo + cusdInCelo + usdcInCelo;

  // USD straight from the per-token on-chain volumes: CELO at the live rate,
  // cUSD + USDC at their $1 peg. No round-trip through the CELO conversion.
  const totalVolumeUsd =
    Number(formatUnits(volCelo, 18)) * celoUsdPrice +
    Number(formatUnits(volCusd, 18)) +
    Number(formatUnits(volUsdc, 6));

  return {
    bountyCount,
    totalBountyVolume: volCusd + volCelo + volUsdc,
    totalProtocolRevenue: revCusd + revCelo + revUsdc,
    totalBountiesResolved,
    uniquePosterCount,
    uniqueWorkerCount,
    feeBps,
    graceSeconds,
    volumeByToken: { cUSD: volCusd, CELO: volCelo, USDC: volUsdc },
    totalVolumeInCelo,
    celoUsdPrice,
    totalVolumeUsd,
  };
}
