import { ArrowUpRight, Trophy } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { txUrl } from "@/lib/celoscan";
import { formatCELO } from "@/lib/format-token";
import type { WorkerHistoryRow } from "@/lib/worker-history";

export function WorkerHistoryCard({ rows }: { rows: WorkerHistoryRow[] }) {
  return (
    <GlassCard className="!p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Trophy aria-hidden="true" className="h-4 w-4" />
        </span>
        <h2 className="font-display text-lg font-semibold">Resolved bounties</h2>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No bounty wins recorded in the recent block window.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60">
          {rows.map((row) => (
            <li
              key={row.txHash}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">Bounty #{row.bountyId.toString()}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Payout {formatCELO(row.winnerPayout)} CELO
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
      )}
    </GlassCard>
  );
}
