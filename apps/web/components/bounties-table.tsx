"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { MAINNET, ZERO_ADDRESS } from "@yeheskieltame/claudelance-types";

import { Button } from "@/components/ui/button";
import { TOKEN_BADGE, type TokenSymbol } from "@/lib/token-theme";
import { formatDeadline } from "@/lib/format-deadline";
import { formatTokenAmount } from "@/lib/format-token";
import { cn } from "@/lib/utils";

type ApiBounty = {
  id: string;
  poster: string;
  amount: string;
  winner: string;
  token: string;
  deadline: string;
  maxSlots: number;
  claimedSlots: number;
  targetWorker: string;
  status: number;
  targetRepoUrl: string;
  instructionUrl: string;
};

type StatusFilter = "open" | "resolved" | "expired" | "all";
type TokenFilter = "all" | "cusd" | "celo" | "usdc";

const PAGE_SIZE = 15;
const FETCH_LIMIT = 50;
const MAX_PAGES = 50;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "expired", label: "Expired" },
  { value: "all", label: "All" },
];

const TOKEN_FILTERS: Array<{ value: TokenFilter; label: string }> = [
  { value: "all", label: "All tokens" },
  { value: "cusd", label: "cUSD" },
  { value: "celo", label: "CELO" },
  { value: "usdc", label: "USDC" },
];

const STATUS_LABELS = ["Open", "Resolved", "Cancelled", "Expired"] as const;

// Resolve token addresses for the mainnet deployment so symbol/decimals are correct.
const DEPLOYMENT = MAINNET;

function symbolForAddress(address: string): TokenSymbol | null {
  const a = address.toLowerCase();
  if (a === DEPLOYMENT.tokens.cUSD.toLowerCase()) return "cUSD";
  if (a === DEPLOYMENT.tokens.CELO.toLowerCase()) return "CELO";
  if (a === DEPLOYMENT.tokens.USDC.toLowerCase()) return "USDC";
  return null;
}

function decimalsFor(symbol: TokenSymbol | null): number {
  return symbol === "USDC" ? 6 : 18;
}

function formatReward(amount: string, symbol: TokenSymbol | null): string {
  try {
    return formatTokenAmount(BigInt(amount), decimalsFor(symbol), 2);
  } catch {
    return "0";
  }
}

function deriveTitle(bounty: ApiBounty): string {
  if (bounty.targetRepoUrl) {
    return bounty.targetRepoUrl.replace(/^https?:\/\/github\.com\//i, "");
  }
  return `Bounty #${bounty.id}`;
}

function effectiveStatus(status: number, deadline: string): { label: string; className: string } {
  if (status === 0) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Number(deadline) <= nowSeconds) {
      return { label: "Expired", className: "bg-muted text-muted-foreground" };
    }
    return { label: "Open", className: "bg-primary/10 text-primary" };
  }
  if (status === 1) {
    return {
      label: "Resolved",
      className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    };
  }
  return { label: STATUS_LABELS[status] ?? "Unknown", className: "bg-muted text-muted-foreground" };
}

async function fetchBounties(status: StatusFilter, signal: AbortSignal): Promise<ApiBounty[]> {
  const out: ApiBounty[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({ limit: String(FETCH_LIMIT) });
    if (status !== "all") params.set("status", status);
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`/api/bounties?${params.toString()}`, {
      headers: { accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);

    const data = (await response.json()) as { items?: ApiBounty[]; nextCursor?: string | null };
    out.push(...(data.items ?? []));
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }

  return out;
}

export function BountiesTable() {
  const [status, setStatus] = React.useState<StatusFilter>("open");
  const [token, setToken] = React.useState<TokenFilter>("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [items, setItems] = React.useState<ApiBounty[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const lastStatus = React.useRef<StatusFilter | null>(null);

  // Refetch when the tab regains focus: a poster coming back from a wallet
  // confirmation expects current bounty states, not the snapshot from when
  // the list first loaded.
  React.useEffect(() => {
    const bump = () => {
      if (document.visibilityState === "visible") setRefreshKey((k) => k + 1);
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  // Refetch when the server-side status filter changes (with the loading
  // state) or on a focus refresh (silently, keeping the current rows on
  // screen); token + search are applied client-side over the loaded set.
  React.useEffect(() => {
    const controller = new AbortController();
    const statusChanged = lastStatus.current !== status;
    lastStatus.current = status;
    if (statusChanged) setIsLoading(true);
    setError(null);

    fetchBounties(status, controller.signal)
      .then((rows) => {
        setItems(rows);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setError("Bounties are not available right now. Try again in a moment.");
        setIsLoading(false);
        void err;
      });

    return () => controller.abort();
  }, [status, refreshKey]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((bounty) => {
        if (token !== "all") {
          const symbol = symbolForAddress(bounty.token);
          if (!symbol || symbol.toLowerCase() !== token) return false;
        }
        if (!q) return true;
        const haystack = `${bounty.id} ${deriveTitle(bounty)} ${bounty.instructionUrl}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)));
  }, [items, token, query]);

  React.useEffect(() => {
    setPage(1);
  }, [token, query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-24 pt-10 sm:pt-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
            Open marketplace
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Browse bounties
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Live escrowed work read straight from the Core contract. Defaults to
            open bounties you can still claim; switch to Resolved or All to see
            history.
          </p>
        </div>
        <Button asChild className="shrink-0 self-start rounded-full sm:self-end">
          <Link href="/post">
            Post a bounty
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <label className="relative block">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by id, repository, or issue"
            aria-label="Search bounties"
            className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          />
        </label>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter by status"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {STATUS_FILTERS.map((option) => {
              const isActive = status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="relative shrink-0">
            <select
              value={token}
              onChange={(event) => setToken(event.target.value as TokenFilter)}
              aria-label="Filter by token"
              className="h-9 appearance-none rounded-full border border-border bg-card pl-3.5 pr-8 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {TOKEN_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : isLoading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading bounties
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          message={
            status === "open"
              ? "No open bounties right now. Check Resolved or All, or post one."
              : status === "expired"
                ? "No expired bounties found."
                : "No bounties match these filters."
          }
        />
      ) : (
        <>
          {/* Mobile: cards (no horizontal overflow) */}
          <div className="space-y-3 sm:hidden">
            {visible.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">#</th>
                  <th scope="col" className="px-4 py-3 font-medium">Bounty</th>
                  <th scope="col" className="px-4 py-3 font-medium">Token</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Reward</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Deadline</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Slots</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((bounty) => {
                  const symbol = symbolForAddress(bounty.token);
                  const isDirectHire = bounty.targetWorker.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
                  const s = effectiveStatus(bounty.status, bounty.deadline);
                  return (
                    <tr
                      key={bounty.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">{bounty.id}</td>
                      <td className="px-4 py-3">
                        <span className="block max-w-[260px] truncate font-medium text-foreground">
                          {deriveTitle(bounty)}
                        </span>
                        {isDirectHire ? (
                          <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Direct hire
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                            symbol ? TOKEN_BADGE[symbol] : "bg-muted text-muted-foreground ring-border",
                          )}
                        >
                          {symbol ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-foreground">
                        {formatReward(bounty.amount, symbol)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", s.className)}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDeadline(bounty.deadline)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {bounty.claimedSlots}/{bounty.maxSlots}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/bounty/${bounty.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                        >
                          View
                          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && !error && filtered.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {start + 1}–{start + visible.length} of {filtered.length}{" "}
            {filtered.length === 1 ? "bounty" : "bounties"}
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
      ) : null}
    </section>
  );
}

function BountyCard({ bounty }: { bounty: ApiBounty }) {
  const symbol = symbolForAddress(bounty.token);
  const isDirectHire = bounty.targetWorker.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
  const s = effectiveStatus(bounty.status, bounty.deadline);

  return (
    <Link
      href={`/bounty/${bounty.id}`}
      className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 active:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">#{bounty.id}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-medium", s.className)}>
              {s.label}
            </span>
            {isDirectHire ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
                Direct hire
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 truncate font-medium text-foreground">{deriveTitle(bounty)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
            symbol ? TOKEN_BADGE[symbol] : "bg-muted text-muted-foreground ring-border",
          )}
        >
          {symbol ?? "—"}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatReward(bounty.amount, symbol)} <span className="text-muted-foreground">{symbol}</span>
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatDeadline(bounty.deadline)} · {bounty.claimedSlots}/{bounty.maxSlots} slots
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="secondary" className="mt-4">
        <Link href="/post">Post a bounty</Link>
      </Button>
    </div>
  );
}
