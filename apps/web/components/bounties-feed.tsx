"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarClock, Coins, ExternalLink, GitPullRequest, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDeadline } from "@/lib/format-deadline";
import { cn } from "@/lib/utils";

type BountyStatus = "open" | "resolved" | "cancelled" | "expired";
type TokenFilter = "cusd" | "celo" | "usdc";
type StatusFilter = "open" | "resolved";
type FilterValue = "all" | TokenFilter | StatusFilter;

type ApiBounty = {
  id?: string | number;
  title?: string;
  description?: string;
  targetRepoUrl?: string;
  instructionUrl?: string;
  repo?: string;
  token?: string;
  tokenSymbol?: string;
  amount?: string | number;
  deadline?: string | number;
  status?: string | number;
  claimedSlots?: number;
  maxSlots?: number;
  ciRequired?: boolean;
};

type BountiesResponse = {
  items?: ApiBounty[];
  nextCursor?: string | null;
  total?: number;
};

const FILTERS: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "cUSD", value: "cusd" },
  { label: "CELO", value: "celo" },
  { label: "USDC", value: "usdc" },
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
];

const TOKEN_STYLES: Record<string, string> = {
  cusd: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  celo: "bg-amber-400/15 text-amber-800 ring-amber-400/30 dark:text-amber-200",
  usdc: "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300",
};

function labelFor(value: FilterValue): string {
  const match = FILTERS.find((f) => f.value === value);
  return match?.label ?? "All";
}

function parseFilter(raw: string | null): FilterValue {
  if (raw === "cusd" || raw === "celo" || raw === "usdc") return raw;
  if (raw === "open" || raw === "resolved") return raw;
  return "all";
}

export function BountiesFeed() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = React.useState<FilterValue>(() =>
    parseFilter(searchParams?.get("filter") ?? null),
  );
  const [items, setItems] = React.useState<ApiBounty[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const requestIdRef = React.useRef(0);

  const loadPage = React.useCallback(
    async (cursor?: string | null, mode: "replace" | "append" = "replace") => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({ limit: "12" });
      if (cursor) params.set("cursor", cursor);
      if (isTokenFilter(activeFilter)) params.set("token", activeFilter);
      if (isStatusFilter(activeFilter)) params.set("status", activeFilter);

      try {
        const response = await fetch(`/api/bounties?${params.toString()}`, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) throw new Error(`Request failed with ${response.status}`);

        const data = (await response.json()) as BountiesResponse;
        if (requestId !== requestIdRef.current) return;

        setItems((current) =>
          mode === "append" ? [...current, ...(data.items ?? [])] : data.items ?? [],
        );
        setNextCursor(data.nextCursor ?? null);
        setTotal(typeof data.total === "number" ? data.total : null);
      } catch {
        if (requestId !== requestIdRef.current) return;
        if (mode === "replace") setItems([]);
        setNextCursor(null);
        setError("Bounties are not available yet. Try again in a moment.");
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [activeFilter],
  );

  React.useEffect(() => {
    void loadPage(null, "replace");
  }, [loadPage]);

  React.useEffect(() => {
    const fromUrl = parseFilter(searchParams?.get("filter") ?? null);
    if (fromUrl !== activeFilter) {
      setActiveFilter(fromUrl);
    }
  }, [searchParams, activeFilter]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && nextCursor && !isLoading) {
        void loadPage(nextCursor, "append");
      }
    }, { rootMargin: "360px" });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLoading, loadPage, nextCursor]);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-24 pt-10 sm:pt-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Open marketplace</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Browse bounties
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Filter live escrowed work by token and status. Scroll to load the next page.
          </p>
        </div>
        <Button asChild>
          <Link href="/post">
            Post a bounty
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1" aria-label="Bounty filters">
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setActiveFilter(filter.value);
                const params = new URLSearchParams(searchParams?.toString() ?? "");
                if (filter.value === "all") params.delete("filter");
                else params.set("filter", filter.value);
                const next = params.toString();
                router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
              }}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          );
        })}
        {activeFilter !== "all" && (
          <button
            type="button"
            onClick={() => {
              setActiveFilter("all");
              const params = new URLSearchParams(searchParams?.toString() ?? "");
              params.delete("filter");
              const next = params.toString();
              router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Clear filter"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {error ? <EmptyState message={error} /> : null}

      {activeFilter !== "all" && !error && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Filtered by{" "}
          <span className="font-medium text-foreground">{labelFor(activeFilter)}</span>
          {" "}— {items.length}
          {total != null && total !== items.length ? ` of ${total}` : ""} matching
        </p>
      )}

      {!error && items.length === 0 && !isLoading ? (
        <EmptyState message="No matching bounties yet." />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((bounty, index) => (
          <BountyFeedCard key={String(bounty.id ?? index)} bounty={bounty} />
        ))}
      </div>

      <div ref={sentinelRef} className="flex min-h-16 items-center justify-center">
        {isLoading ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bounties
          </span>
        ) : null}
        {!isLoading && items.length > 0 && !nextCursor ? (
          <span className="text-sm text-muted-foreground">
            {total === null ? "End of feed" : `${items.length} of ${total} bounties loaded`}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function BountyFeedCard({ bounty }: { bounty: ApiBounty }) {
  const token = normalizeToken(bounty);
  const status = normalizeStatus(bounty.status);
  const deadline = formatDeadline(bounty.deadline);
  const amount = formatAmount(bounty.amount);
  const title = bounty.title ?? deriveTitle(bounty);
  const description = bounty.description ?? bounty.instructionUrl ?? "Review the linked issue for full acceptance criteria.";
  const href = bounty.instructionUrl ?? bounty.targetRepoUrl ?? `/bounty/${bounty.id ?? ""}`;

  return (
    <article className="group flex min-h-64 flex-col rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur transition motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-glass">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", TOKEN_STYLES[token.toLowerCase()] ?? "bg-muted text-muted-foreground ring-border")}>
          <Coins className="h-3.5 w-3.5" />
          {token}
        </span>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-xs font-medium",
          status === "resolved" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" : "bg-primary/10 text-primary",
        )}>
          {capitalize(status)}
        </span>
      </div>

      <h2 className="mt-4 line-clamp-1 text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Coins className="h-4 w-4 text-foreground" />
          {amount} {token}
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-foreground" />
          {deadline}
        </span>
        <span className="inline-flex items-center gap-2">
          <GitPullRequest className="h-4 w-4 text-foreground" />
          {(bounty.claimedSlots ?? 0).toString()} / {(bounty.maxSlots ?? 1).toString()} slots claimed
        </span>
      </div>

      <Link
        href={href}
        className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 pt-5 text-sm font-medium text-primary"
      >
        View bounty
        <ExternalLink className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="secondary" className="mt-4">
        <Link href="/post">Post a bounty</Link>
      </Button>
    </div>
  );
}

function isTokenFilter(value: FilterValue): value is TokenFilter {
  return value === "cusd" || value === "celo" || value === "usdc";
}

function isStatusFilter(value: FilterValue): value is StatusFilter {
  return value === "open" || value === "resolved";
}

function normalizeToken(bounty: ApiBounty) {
  const symbol = bounty.tokenSymbol ?? bounty.token ?? "cUSD";
  const normalized = symbol.toString().replace(/^0x[a-f0-9]+$/i, "cUSD").toLowerCase();
  if (normalized === "cusd") return "cUSD";
  if (normalized === "celo") return "CELO";
  if (normalized === "usdc") return "USDC";
  return symbol.toString();
}

function normalizeStatus(status: ApiBounty["status"]): BountyStatus {
  if (status === 1 || String(status).toLowerCase() === "resolved") return "resolved";
  if (status === 2 || String(status).toLowerCase() === "cancelled") return "cancelled";
  if (status === 3 || String(status).toLowerCase() === "expired") return "expired";
  return "open";
}

function formatAmount(amount: ApiBounty["amount"]) {
  if (amount === undefined || amount === null || amount === "") return "0";
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return String(amount);
  if (numeric > 1_000_000) return (numeric / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}


function deriveTitle(bounty: ApiBounty) {
  if (bounty.repo) return bounty.repo;
  if (bounty.targetRepoUrl) {
    return bounty.targetRepoUrl.replace(/^https?:\/\/github\.com\//, "");
  }
  return `Bounty ${bounty.id ?? ""}`.trim();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
