import { ArrowUpRight, Sparkles } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { txUrl } from "@/lib/celoscan";
import { fetchRecentResolved } from "@/lib/recent-bounties";
import { formatCELO } from "@/lib/format-token";
import { shortAddress } from "@/lib/utils";

export async function RecentActivityFeed() {
  let rows: Awaited<ReturnType<typeof fetchRecentResolved>> = [];
  try {
    rows = await fetchRecentResolved(5);
  } catch {
    return null;
  }

  if (rows.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <Sparkles aria-hidden="true" className="h-3 w-3" />
        Live activity
      </div>
      <GlassCard className="!p-0 overflow-hidden">
        <ul className="divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.txHash} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  Bounty #{row.bountyId.toString()} resolved
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Winner {shortAddress(row.winner)} · {formatCELO(row.winnerPayout)} CELO
                </p>
              </div>
              <a
                href={txUrl(row.txHash)}
                target="_blank"
                rel="noreferrer"
                className="touch-target inline-flex items-center gap-1 rounded-full text-xs text-muted-foreground hover:text-foreground"
                aria-label="View resolution tx on Celoscan"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
      </GlassCard>
    </section>
  );
}
