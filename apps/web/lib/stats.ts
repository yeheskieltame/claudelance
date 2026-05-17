import { createPublicClient, http } from "viem";

import { celoSepolia, celoMainnet, DEFAULT_CHAIN_ID, chainById } from "./chain";
import { coreAbi, getDeployment } from "./contracts";
import { MAINNET } from "@yeheskieltame/claudelance-types";

export type LiveStats = {
  bountyCount: bigint;
  totalBountyVolumeCUSD: bigint;
  totalBountyVolumeCELO: bigint;
  totalBountyVolumeUSDC: bigint;
  totalProtocolRevenueCELO: bigint;
  totalBountiesResolved: bigint;
  uniquePosterCount: bigint;
  uniqueWorkerCount: bigint;
  feeBps: bigint;
  graceSeconds: bigint;
};

const rpcOverrides: Partial<Record<number, string>> = {
  [celoSepolia.id]: process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC,
  [celoMainnet.id]: process.env.NEXT_PUBLIC_CELO_MAINNET_RPC,
};

export async function fetchLiveStats(chainId: number = DEFAULT_CHAIN_ID): Promise<LiveStats> {
  const chain = chainById(chainId);
  if (!chain) throw new Error(`Unsupported chain id ${chainId}`);
  const rpc = rpcOverrides[chainId] ?? chain.rpcUrls.default.http[0];
  const client = createPublicClient({ chain, transport: http(rpc) });
  const deploy = getDeployment(chainId);

  const isMainnet = chainId === celoMainnet.id;

  const commonReads = [
    { address: deploy.core, abi: coreAbi, functionName: "bountyCount" as const },
    { address: deploy.core, abi: coreAbi, functionName: "totalBountiesResolved" as const },
    { address: deploy.core, abi: coreAbi, functionName: "uniquePosterCount" as const },
    { address: deploy.core, abi: coreAbi, functionName: "uniqueWorkerCount" as const },
    { address: deploy.core, abi: coreAbi, functionName: "PROTOCOL_FEE_BPS" as const },
    { address: deploy.core, abi: coreAbi, functionName: "RESOLUTION_GRACE_PERIOD" as const },
  ];

  const tokenReads = isMainnet
    ? [
        {
          address: deploy.core,
          abi: coreAbi,
          functionName: "totalBountyVolume" as const,
          args: [MAINNET.tokens.cUSD],
        },
        {
          address: deploy.core,
          abi: coreAbi,
          functionName: "totalBountyVolume" as const,
          args: [MAINNET.tokens.CELO],
        },
        {
          address: deploy.core,
          abi: coreAbi,
          functionName: "totalBountyVolume" as const,
          args: [MAINNET.tokens.USDC],
        },
        {
          address: deploy.core,
          abi: coreAbi,
          functionName: "totalProtocolRevenue" as const,
          args: [MAINNET.tokens.CELO],
        },
      ]
    : [
        {
          address: deploy.core,
          abi: coreAbi,
          functionName: "totalBountyVolume" as const,
        },
        {
          address: deploy.core,
          abi: coreAbi,
          functionName: "totalProtocolRevenue" as const,
        },
      ];

  const allReads = [...tokenReads, ...commonReads];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reads = (await client.multicall({ contracts: allReads as any, allowFailure: false })) as bigint[];

  if (isMainnet) {
    return {
      bountyCount: reads[0]!,
      totalBountyVolumeCUSD: reads[1]!,
      totalBountyVolumeCELO: reads[2]!,
      totalBountyVolumeUSDC: reads[3]!,
      totalProtocolRevenueCELO: reads[4]!,
      totalBountiesResolved: reads[5]!,
      uniquePosterCount: reads[6]!,
      uniqueWorkerCount: reads[7]!,
      feeBps: reads[8]!,
      graceSeconds: reads[9]!,
    };
  }

  return {
    bountyCount: reads[0]!,
    totalBountyVolumeCUSD: reads[1]!,
    totalBountyVolumeCELO: 0n,
    totalBountyVolumeUSDC: 0n,
    totalProtocolRevenueCELO: 0n,
    totalBountiesResolved: reads[2]!,
    uniquePosterCount: reads[3]!,
    uniqueWorkerCount: reads[4]!,
    feeBps: reads[5]!,
    graceSeconds: reads[6]!,
  };
}