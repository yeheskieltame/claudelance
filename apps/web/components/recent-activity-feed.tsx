import { ArrowUpRight, Radio } from "lucide-react";

import { txUrl } from "@/lib/celoscan";
import { fetchRecentResolved } from "@/lib/recent-bounties";
import { formatTokenAmount } from "@/lib/format-token";
import { shortAddress } from "@/lib/utils";

const TOKEN_COLOR: Record<string, string> = {
  cusd: "text-emerald-400",
  celo: "text-primary",
  usdc: "text-sky-400",
};

export async function RecentActivityFeed() {
  let rows: Awaited<ReturnType<typeof fetchRecentResolved>> = [];
  try {
    rows = await fetchRecentResolved(7);
  } catch {
    return <TerminalShell empty />;
  }

  if (rows.length === 0) return <TerminalShell empty />;

  return (
    <div className="glow-card animate-fade-up delay-200 overflow-hidden shadow-glass">
      {/* Terminal title bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
            Live Activity
          </span>
        </div>
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground/60">
          last {rows.length}
        </span>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-border/50">
        {rows.map((row) => {
          const tokenClass =
            TOKEN_COLOR[row.tokenSymbol.toLowerCase()] ?? "text-foreground";
          return (
            <li key={row.txHash}>
              <a
                href={txUrl(row.txHash)}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-xs transition-colors hover:bg-accent/50"
                aria-label={`Bounty ${row.bountyId.toString()} resolved, view on Celoscan`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 font-semibold text-primary">
                    B#{row.bountyId.toString()}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {shortAddress(row.winner)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular-nums text-foreground">
                    {formatTokenAmount(row.winnerPayout, row.tokenDecimals)}
                  </span>
                  <span className={tokenClass}>{row.tokenSymbol}</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {/* Footer note */}
      <div className="border-t border-border px-4 py-2.5">
        <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground/60">
          Every payout settled onchain
        </p>
      </div>
    </div>
  );
}

function TerminalShell({ empty }: { empty?: boolean }) {
  return (
    <div className="glow-card animate-fade-up delay-200 overflow-hidden shadow-glass">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
          Live Activity
        </span>
      </div>
      <div className="flex min-h-[15rem] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
          <Radio className="h-5 w-5" />
        </span>
        <p className="font-mono text-xs text-muted-foreground">
          {empty ? "Listening for the next resolution" : "Connecting to Celo…"}
        </p>
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground/50">
          Mainnet · ClaudelanceCore v2
        </span>
      </div>
    </div>
  );
}
