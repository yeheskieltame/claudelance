import { createPublicClient, http } from "viem";

import { celoSepolia, DEFAULT_CHAIN_ID, chainById } from "./chain";
import { coreAbi, getDeployment } from "./contracts";
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

  const globals = (await client.multicall({
    contracts: [
      { address: deploy.core, abi: coreAbi, functionName: "bountyCount" },
      { address: deploy.core, abi: coreAbi, functionName: "totalBountiesResolved" },
      { address: deploy.core, abi: coreAbi, functionName: "uniquePosterCount" },
      { address: deploy.core, abi: coreAbi, functionName: "uniqueWorkerCount" },
      { address: deploy.core, abi: coreAbi, functionName: "PROTOCOL_FEE_BPS" },
      { address: deploy.core, abi: coreAbi, functionName: "RESOLUTION_GRACE_PERIOD" },
    ],
    allowFailure: false,
  })) as bigint[];

  const perToken = (await client.multicall({
    contracts: [
      { address: deploy.core, abi: coreAbi, functionName: "totalBountyVolume", args: [deploy.cUSD] },
      { address: deploy.core, abi: coreAbi, functionName: "totalBountyVolume", args: [deploy.CELO] },
      { address: deploy.core, abi: coreAbi, functionName: "totalBountyVolume", args: [deploy.USDC] },
      { address: deploy.core, abi: coreAbi, functionName: "totalProtocolRevenue", args: [deploy.cUSD] },
      { address: deploy.core, abi: coreAbi, functionName: "totalProtocolRevenue", args: [deploy.CELO] },
      { address: deploy.core, abi: coreAbi, functionName: "totalProtocolRevenue", args: [deploy.USDC] },
    ],
    allowFailure: false,
  })) as bigint[];

  const [bountyCount, totalBountiesResolved, uniquePosterCount, uniqueWorkerCount, feeBps, graceSeconds] =
    globals as [bigint, bigint, bigint, bigint, bigint, bigint];
  const [volCusd, volCelo, volUsdc, revCusd, revCelo, revUsdc] = perToken as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];

  const celoUsdPrice = await getCeloUsdPrice();
  const cusdInCelo = tokenToCeloWei(volCusd, 18, 1, celoUsdPrice);
  const usdcInCelo = tokenToCeloWei(volUsdc, 6, 1, celoUsdPrice);
  const totalVolumeInCelo = volCelo + cusdInCelo + usdcInCelo;

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
  };
}
