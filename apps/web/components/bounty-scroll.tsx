"use client";

import * as React from "react";
import { ArrowRight, CalendarClock, Coins, ExternalLink } from "lucide-react";
import Link from "next/link";

type ApiBounty = {
  id?: string | number;
  token?: string;
  tokenSymbol?: string;
  targetRepoUrl?: string;
  instructionUrl?: string;
  amount?: string | number;
  deadline?: string | number;
  status?: string | number;
  claimedSlots?: number;
  maxSlots?: number;
  ciRequired?: boolean;
};

type BountiesResponse = {
  items?: ApiBounty[];
  total?: number;
};

const TOKEN_STYLES: Record<string, { chipClassName: string }> = {
  cusd: { chipClassName: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" },
  celo: { chipClassName: "border-amber-500/30 bg-amber-400/15 text-amber-700 dark:text-amber-200" },
  usdc: { chipClassName: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200" },
};

function formatAmount(amount: string | number | undefined): string {
  if (amount === undefined || amount === null || amount === "") return "0";
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return String(amount);
  if (numeric > 1_000_000) return (numeric / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDeadline(deadline: string | number | undefined): string {
  if (!deadline) return "No deadline";
  const numeric = Number(deadline);
  const date = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
  if (Number.isNaN(date.getTime())) return "No deadline";
  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (diffDays <= 0) return "Expired";
  if (diffDays === 1) return "1 day left";
  return `${diffDays}d left`;
}

function deriveTitle(bounty: ApiBounty): string {
  if (bounty.targetRepoUrl) {
    return bounty.targetRepoUrl.replace(/^https?:\/\/github\.com\//, "");
  }
  return `Bounty ${bounty.id ?? ""}`.trim();
}

function normalizeToken(bounty: ApiBounty): string {
  const s = bounty.tokenSymbol ?? bounty.token ?? "CELO";
  const n = s.toString().toLowerCase();
  if (n.includes("usd")) return "cUSD";
  if (n.includes("celo")) return "CELO";
  if (n.includes("usdc")) return "USDC";
  return s.toString();
}

export function BountyScroll() {
  const [items, setItems] = React.useState<ApiBounty[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/bounties?limit=5&status=open", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: BountiesResponse) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 pb-16">
        <div className="flex gap-4 overflow-x-auto pb-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-32 w-64 shrink-0 animate-pulse items-center justify-center rounded-2xl border border-border bg-card"
            >
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-primary">Latest open bounties</h2>
        <Link
          href="/bounties"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none]">
        {[...items].slice(0, 5).map((bounty) => {
          const token = normalizeToken(bounty);
          const tokenStyle = TOKEN_STYLES[token.toLowerCase()] ?? { chipClassName: "border-border bg-muted text-muted-foreground" };
          return (
            <Link
              key={String(bounty.id ?? Math.random())}
              href={bounty.instructionUrl ?? bounty.targetRepoUrl ?? `/bounties`}
              target="_blank"
              rel="noreferrer"
              className="group flex h-40 w-64 shrink-0 flex-col justify-between rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur transition motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-glass"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tokenStyle.chipClassName}`}
                >
                  <Coins className="h-3 w-3" />
                  {token}
                </span>
              </div>
              <div className="mt-auto">
                <p className="line-clamp-2 text-sm font-semibold leading-5">{deriveTitle(bounty)}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{formatAmount(bounty.amount)} {token}</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {formatDeadline(bounty.deadline)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}