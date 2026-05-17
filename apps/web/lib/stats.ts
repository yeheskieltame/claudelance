import { createPublicClient, http } from "viem";

import { celoSepolia, DEFAULT_CHAIN_ID, chainById } from "./chain";
import { coreAbi, getDeployment } from "./contracts";

export type LiveStats = {
  bountyCount: bigint;
  totalBountyVolume: bigint;
  totalProtocolRevenue: bigint;
  totalBountiesResolved: bigint;
  uniquePosterCount: bigint;
  uniqueWorkerCount: bigint;
  feeBps: bigint;
  graceSeconds: bigint;
};

const rpcOverrides: Partial<Record<number, string>> = {
  [celoSepolia.id]: process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC,
  42_220: process.env.NEXT_PUBLIC_CELO_MAINNET_RPC,
};

export async function fetchLiveStats(chainId: number = DEFAULT_CHAIN_ID): Promise<LiveStats> {
  const chain = chainById(chainId);
  if (!chain) throw new Error(`Unsupported chain id ${chainId}`);
  const rpc = rpcOverrides[chainId] ?? chain.rpcUrls.default.http[0];
  const client = createPublicClient({ chain, transport: http(rpc) });
  const deploy = getDeployment(chainId);

  const read = (functionName: "bountyCount" | "PROTOCOL_FEE_BPS" | "RESOLUTION_GRACE_PERIOD") =>
    client.readContract({ address: deploy.core, abi: coreAbi, functionName });

  const [bountyCount, stats, feeBps, graceSeconds] = await Promise.all([
    read("bountyCount"),
    client.readContract({
      address: deploy.core,
      abi: coreAbi,
      functionName: "getStats",
      args: [deploy.tokens.CELO],
    }),
    read("PROTOCOL_FEE_BPS"),
    read("RESOLUTION_GRACE_PERIOD"),
  ]);

  const [totalBountyVolume, totalProtocolRevenue, totalBountiesResolved, uniquePosterCount, uniqueWorkerCount] =
    stats as readonly [bigint, bigint, bigint, bigint, bigint];

  return {
    bountyCount,
    totalBountyVolume,
    totalProtocolRevenue,
    totalBountiesResolved,
    uniquePosterCount,
    uniqueWorkerCount,
    feeBps,
    graceSeconds: graceSeconds as bigint,
  };
}
