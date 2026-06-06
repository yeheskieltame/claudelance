import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, User, Trophy, Clock, Coins, Shield, Layers, Github, Lock } from "lucide-react";
import Link from "next/link";
import { MAINNET_V3, TASK_TYPE_LABELS, TASK_TYPE_NAMES } from "@yeheskieltame/claudelance-types";

import { Header } from "@/components/header";
import { BountyDetailClient } from "@/components/bounty-detail";
import { GlassCard } from "@/components/ui/card";
import { formatTokenAmount } from "@/lib/format-token";
import { shortAddress } from "@/lib/utils";
import { txUrl } from "@/lib/celoscan";

type Params = Promise<{ id: string }>;

type BountyJson = {
  id: string;
  poster: string;
  amount: string;
  winner: string;
  stakeRequired: string;
  token: string;
  deadline: string;
  maxSlots: number;
  claimedSlots: number;
  bountyType: number;
  ciRequired: boolean;
  targetWorker: string;
  status: number;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash: string;
  claimers: string[];
  submissions: Array<{
    worker: string;
    deliverableUrl: string;
    ciPassed: boolean;
    deliverableHash: string;
  }>;
};

async function fetchBounty(id: string): Promise<BountyJson | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/bounty/${id}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function BountyDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const bounty = await fetchBounty(id);

  if (!bounty) notFound();

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <Header />

      <section className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28">
        <Link
          href="/bounties"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bounties
        </Link>

        <BountyHeader bounty={bounty} />

        <Suspense
          fallback={
            <GlassCard className="mt-6 !p-8">
              <div className="h-32 animate-pulse rounded-xl bg-muted" />
            </GlassCard>
          }
        >
          <BountyDetailClient bounty={bounty} />
        </Suspense>
      </section>
    </main>
  );
}

function BountyHeader({ bounty }: { bounty: BountyJson }) {
  const token = normalizeTokenSymbol(bounty.token);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const isPastDeadline = Number(bounty.deadline) <= nowSeconds;
  const isDirectHire =
    bounty.targetWorker !== "0x0000000000000000000000000000000000000000";
  const statusLabel =
    bounty.status === 1
      ? "Resolved"
      : bounty.status === 2
        ? "Cancelled"
        : bounty.status === 3 || (bounty.status === 0 && isPastDeadline)
          ? "Expired"
          : "Open";
  const statusColor =
    statusLabel === "Resolved"
      ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20"
      : statusLabel === "Open"
        ? "bg-primary/10 text-primary border border-primary/20"
        : "bg-muted text-muted-foreground border border-border";

  const repoTitle = bounty.bountyType === 0 && bounty.targetRepoUrl
    ? bounty.targetRepoUrl
        .replace(/^https?:\/\/github\.com\//, "")
        .replace(/\/issues\/\d+$/, "")
    : `${TASK_TYPE_NAMES[bounty.bountyType as keyof typeof TASK_TYPE_NAMES] ?? "Task"} ${bounty.requirementsHash ? bounty.requirementsHash.slice(0, 10) + '...' + bounty.requirementsHash.slice(-6) : `Bounty #${bounty.id}`}`;

  const deadlineDate = formatDeadlineFull(bounty.deadline);

  return (
    <div className="flex flex-col gap-5">
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
          #{bounty.id}
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          {TASK_TYPE_LABELS[bounty.bountyType as keyof typeof TASK_TYPE_LABELS] ?? "UNKNOWN"}
        </span>
        {isDirectHire && (
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
            Direct hire
          </span>
        )}
        {bounty.ciRequired && (
          <span className="rounded-full border border-amber-500/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
            CI required
          </span>
        )}
      </div>

      {/* Title */}
      <div>
        <h1 className="text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {repoTitle}
        </h1>
        {(bounty.instructionUrl || bounty.targetRepoUrl) && (
          <a
            href={bounty.instructionUrl || bounty.targetRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Github className="h-4 w-4" aria-hidden />
            View the GitHub issue
            <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden />
          </a>
        )}
      </div>

      {isDirectHire && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Reserved for a specific worker</p>
            <p className="mt-1 text-muted-foreground">
              This is a direct hire — only{" "}
              <Link
                href={`/worker/${bounty.targetWorker.toLowerCase()}`}
                className="font-mono text-primary hover:underline"
              >
                {shortAddress(bounty.targetWorker)}
              </Link>{" "}
              can claim and submit. Don&apos;t start work unless you&apos;re the targeted worker.
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Coins className="h-4 w-4" />} label="Reward" value={`${formatToken(bounty.amount, bounty.token)} ${token}`} highlight />
        <StatCard icon={<Shield className="h-4 w-4" />} label="Stake" value={`${formatToken(bounty.stakeRequired, bounty.token)} ${token}`} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Slots" value={`${bounty.claimedSlots} / ${bounty.maxSlots}`} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Deadline" value={deadlineDate} />
      </div>

      {/* Meta info panel */}
      <GlassCard className="!p-4 !rounded-2xl">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Poster">
            <a
              href={`https://celoscan.io/address/${bounty.poster}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs hover:text-primary transition-colors"
            >
              {shortAddress(bounty.poster)}
            </a>
          </MetaRow>

          {bounty.status === 1 &&
            bounty.winner !== "0x0000000000000000000000000000000000000000" && (
              <MetaRow icon={<Trophy className="h-3.5 w-3.5 text-emerald-500" />} label="Winner">
                <Link
                  href={`/worker/${bounty.winner.toLowerCase()}`}
                  className="font-mono text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-300 transition-colors"
                >
                  {shortAddress(bounty.winner)}
                </Link>
              </MetaRow>
            )}

          {isDirectHire && (
            <MetaRow icon={<User className="h-3.5 w-3.5 text-violet-500" />} label="Targeted worker">
              <Link
                href={`/worker/${bounty.targetWorker.toLowerCase()}`}
                className="font-mono text-xs text-violet-600 hover:text-violet-500 dark:text-violet-300 transition-colors"
              >
                {shortAddress(bounty.targetWorker)}
              </Link>
            </MetaRow>
          )}

          <MetaRow icon={<ExternalLink className="h-3.5 w-3.5" />} label="On-chain">
            <a
              href={`https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#readContract`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ClaudelanceCore · bountyId {bounty.id}
            </a>
          </MetaRow>
        </dl>
      </GlassCard>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <GlassCard className="!p-4 !rounded-2xl">
      <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wider ${highlight ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
        {label}
      </div>
      <p className={`mt-1.5 text-base font-semibold tracking-tight ${highlight ? "text-primary" : ""}`}>
        {value}
      </p>
    </GlassCard>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0 text-muted-foreground">{icon}</span>
      <dt className="w-28 flex-shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function normalizeTokenSymbol(token: string) {
  const TOKENS: Record<string, string> = {
    "0x765DE816845861e75A25fCA122bb6898B8B1282a": "cUSD",
    "0x471EcE3750Da237f93B8E339c536989b8978a438": "CELO",
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": "USDC",
  };
  return (
    TOKENS[token] ?? TOKENS[token.toLowerCase()] ?? token.slice(0, 6) + "..."
  );
}

function formatToken(raw: string, tokenAddress: string): string {
  const decimals =
    tokenAddress.toLowerCase() === MAINNET_V3.tokens.USDC.toLowerCase() ? 6 : 18;
  try {
    return formatTokenAmount(BigInt(raw), decimals, 2);
  } catch {
    return "0";
  }
}

function formatDeadline(deadline: string) {
  const d = Number(deadline);
  const date = new Date(d < 10_000_000_000 ? d * 1000 : d);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days <= 0) return "Expired";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function formatDeadlineFull(deadline: string) {
  const d = Number(deadline);
  const date = new Date(d < 10_000_000_000 ? d * 1000 : d);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (days <= 0) return `${dateStr} · Expired`;
  if (days === 1) return `${dateStr} · 1 day left`;
  return `${dateStr} · ${days}d left`;
}
