import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";

import { celoMainnet, DEFAULT_CHAIN_ID } from "@/lib/chain";
import { getDeployment } from "@/lib/contracts";

export const revalidate = 30;

export async function GET() {
  const startedAt = Date.now();
  const deploy = getDeployment(DEFAULT_CHAIN_ID);

  let blockNumber: string | null = null;
  let rpcMs: number | null = null;
  let rpcOk = false;
  try {
    const client = createPublicClient({
      chain: celoMainnet,
      transport: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
    });
    const rpcStart = Date.now();
    const block = await client.getBlockNumber();
    rpcMs = Date.now() - rpcStart;
    blockNumber = block.toString();
    rpcOk = true;
  } catch {
    rpcOk = false;
  }

  return NextResponse.json(
    {
      ok: rpcOk,
      chainId: DEFAULT_CHAIN_ID,
      core: deploy.core,
      blockNumber,
      rpcMs,
      uptimeStartedAt: startedAt,
    },
    { headers: { "cache-control": "public, max-age=30, s-maxage=30" } },
  );
}
