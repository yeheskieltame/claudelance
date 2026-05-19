import { NextResponse } from "next/server";

import { fetchLiveStats } from "@/lib/stats";

export const revalidate = 30;

export async function GET() {
  try {
    const stats = await fetchLiveStats();
    return NextResponse.json(
      {
        bountyCount: stats.bountyCount.toString(),
        totalBountyVolume: stats.totalBountyVolume.toString(),
        totalProtocolRevenue: stats.totalProtocolRevenue.toString(),
        totalBountiesResolved: stats.totalBountiesResolved.toString(),
        uniquePosterCount: stats.uniquePosterCount.toString(),
        uniqueWorkerCount: stats.uniqueWorkerCount.toString(),
        feeBps: Number(stats.feeBps),
        graceSeconds: Number(stats.graceSeconds),
      },
      { headers: { "cache-control": "public, max-age=30, s-maxage=30" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "stats unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
