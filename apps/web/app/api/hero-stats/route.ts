import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";

import { celoMainnet } from "@/lib/chain";
import { getDeployment } from "@/lib/contracts";
import { MAINNET } from "@yeheskieltame/claudelance-types";

export const revalidate = 30;

const heroStatsAbi = [
  {
    type: "function",
    name: "totalProtocolRevenue",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bountyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalBountiesResolved",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export async function GET() {
  try {
    const client = createPublicClient({
      chain: celoMainnet,
      transport: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
    });
    const deploy = getDeployment(celoMainnet.id);
    const tokens = {
      CELO: MAINNET.tokens.CELO,
    };

    const [totalProtocolRevenueCELO, bountyCount, totalBountiesResolved] = await client.multicall({
      contracts: [
        { address: deploy.core, abi: heroStatsAbi, functionName: "totalProtocolRevenue", args: [tokens.CELO] },
        { address: deploy.core, abi: heroStatsAbi, functionName: "bountyCount" },
        { address: deploy.core, abi: heroStatsAbi, functionName: "totalBountiesResolved" },
      ],
      allowFailure: true,
    });

    return NextResponse.json(
      {
        totalProtocolRevenueCELO:
          totalProtocolRevenueCELO.status === "success"
            ? (totalProtocolRevenueCELO.result as bigint).toString()
            : "0",
        totalBountyCount: bountyCount.status === "success" ? bountyCount.result.toString() : "0",
        totalResolved:
          totalBountiesResolved.status === "success" ? totalBountiesResolved.result.toString() : "0",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=30",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        totalProtocolRevenueCELO: "0",
        totalBountyCount: "0",
        totalResolved: "0",
      },
      { status: 200 },
    );
  }
}