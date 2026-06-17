import { ArrowUpRight, Trophy } from "lucide-react";
import Link from "next/link";

import { GlassCard } from "@/components/ui/card";
import { formatTokenAmount } from "@/lib/format-token";
import { symbolForAddress } from "@/lib/token-theme";
import type { WorkerHistoryRow } from "@/lib/worker-history";

function formatPayout(amount: bigint, token: string): string {
  const symbol = symbolForAddress(token);
  const decimals = symbol === "USDC" ? 6 : 18;
  return `${formatTokenAmount(amount, decimals, 2)} ${symbol ?? ""}`.trim();
}

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
          No resolved bounty wins for this worker yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60">
          {rows.map((row) => (
            <li
              key={row.bountyId.toString()}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">Bounty #{row.bountyId.toString()}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Payout {formatPayout(row.winnerPayout, row.token)}
                </p>
              </div>
              <Link
                href={`/bounty/${row.bountyId.toString()}`}
                className="touch-target inline-flex items-center gap-1 rounded-full text-xs text-muted-foreground hover:text-foreground"
                aria-label={`View bounty #${row.bountyId.toString()}`}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
