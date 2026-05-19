import { NextResponse } from "next/server";
import type { Address } from "viem";

import { fetchWorkerHistory } from "@/lib/worker-history";
import { fetchWorkerStats } from "@/lib/worker-stats";

export const revalidate = 30;

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

type Params = Promise<{ address: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { address } = await params;

  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const lowercased = address.toLowerCase() as Address;

  try {
    const [stats, history] = await Promise.all([
      fetchWorkerStats(lowercased),
      fetchWorkerHistory(lowercased).catch(() => []),
    ]);

    return NextResponse.json(
      {
        address: lowercased,
        earnings: stats.earnings.map((row) => ({
          symbol: row.symbol,
          token: row.token,
          amount: row.amount.toString(),
        })),
        history: history.map((row) => ({
          bountyId: row.bountyId.toString(),
          winnerPayout: row.winnerPayout.toString(),
          protocolFee: row.protocolFee.toString(),
          txHash: row.txHash,
          blockNumber: row.blockNumber.toString(),
        })),
      },
      { headers: { "cache-control": "public, max-age=30, s-maxage=30" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "worker data unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
