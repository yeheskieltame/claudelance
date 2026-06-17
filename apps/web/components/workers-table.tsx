"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, ExternalLink, Search, ShieldCheck, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { onchainIdentityUrl } from "@/lib/agent-ids";
import { cn, shortAddress } from "@/lib/utils";

export type WorkerRow = {
  rank: number;
  address: string;
  wins: number;
  payout: string;
  hasIdentity: boolean;
  /** ERC-8004 agent id (Identity NFT token id) as a string, if known. */
  agentId?: string;
  /** On-chain ERC-8004 feedback count (reputation). */
  feedbackCount: number;
};

const PAGE_SIZE = 10;

export function WorkersTable({ rows }: { rows: WorkerRow[] }) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.address.toLowerCase().includes(q));
  }, [query, rows]);

  // Reset to the first page whenever the search narrows the result set.
  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <EmptyState message="No resolved bounties recorded in the recent block window yet." />
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <label className="relative block">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by wallet address"
          aria-label="Search workers by address"
          className="h-11 w-full rounded-full border border-border bg-card/70 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        />
      </label>

      {visible.length === 0 ? (
        <EmptyState message={`No workers match “${query.trim()}”.`} />
      ) : (
        <div className="glow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">#</th>
                  <th scope="col" className="px-4 py-3 font-medium">Worker</th>
                  <th scope="col" className="px-4 py-3 font-medium">Identity</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Wins</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Earned</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">On-chain</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.address}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/worker/${row.address.toLowerCase()}`}
                        className="inline-flex items-center gap-2 font-mono text-foreground transition-colors hover:text-primary"
                      >
                        {shortAddress(row.address)}
                        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.hasIdentity ? (
                          <span
                            title="ERC-8004 Agent Identity verified"
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300"
                          >
                            <ShieldCheck aria-hidden className="h-3 w-3" />
                            ERC-8004
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        {row.feedbackCount > 0 && (
                          <span
                            title={`${row.feedbackCount} on-chain ERC-8004 feedback`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300"
                          >
                            <Star aria-hidden className="h-3 w-3" />
                            {row.feedbackCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.wins}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.payout}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={onchainIdentityUrl(row.address)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={
                          row.agentId
                            ? `View ERC-8004 agent #${row.agentId} on 8004scan`
                            : `View ${shortAddress(row.address)} on Celoscan`
                        }
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {row.agentId ? `Agent #${row.agentId}` : "Celoscan"}
                        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length === 0
            ? "0 workers"
            : `Showing ${start + 1}-${start + visible.length} of ${filtered.length} worker${filtered.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {safePage} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount}
            onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
            aria-label="Next page"
          >
            Next
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className={cn(
        "mt-6 rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground",
      )}
    >
      {message}
    </div>
  );
}
