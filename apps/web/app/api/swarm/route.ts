import { NextResponse } from "next/server";

import { fetchActiveWorkers } from "@/lib/active-workers";
import { SWARM_ROSTER } from "@/lib/swarm-roster";

export const revalidate = 30;

export async function GET() {
  let activeSet = new Set<string>();
  try {
    const active = await fetchActiveWorkers();
    activeSet = new Set(active.map((w) => w.address.toLowerCase()));
  } catch {
    // RPC trip — return roster with all idle.
  }

  return NextResponse.json(
    {
      total: SWARM_ROSTER.length,
      activeCount: activeSet.size,
      workers: SWARM_ROSTER.map((addr, idx) => ({
        index: idx + 1,
        address: addr.toLowerCase(),
        active: activeSet.has(addr.toLowerCase()),
      })),
    },
    { headers: { "cache-control": "public, max-age=30, s-maxage=30" } },
  );
}
