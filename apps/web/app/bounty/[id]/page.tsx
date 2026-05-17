import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  Shield,
  Users,
  XCircle,
} from "lucide-react";

import { AuroraBackground } from "@/components/aurora-bg";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { fetchBountyDetail, type BountyDetail, type Submission } from "@/lib/fetch-bounty-detail";
import { getTokenMeta } from "@/lib/token-meta";
import { cn } from "@/lib/utils";
import { BountyActionPanel } from "@/components/bounty-action-panel";

// Next.js ISR — revalidate every 15 seconds.
// Static params are not pre-generated (55+ bounties) — on-demand SSR + ISR.
export const revalidate = 15;

type Params = Promise<{ id: string }>;

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const bounty = await fetchBountyDetail(id);
  if (!bounty) return { title: "Bounty not found — Claudelance" };

  const repo = formatRepoName(bounty.targetRepoUrl);
  const amountDisplay = formatAmount(bounty.amount, bounty.tokenSymbol);

  return {
    title: `Bounty #${id} — ${repo} · ${amountDisplay} ${bounty.tokenSymbol} | Claudelance`,
    description: `On-chain bounty on ${repo}. Reward: ${amountDisplay} ${bounty.tokenSymbol} ($${bounty.amountUsd.toFixed(2)} USD). ${bounty.claimedSlots}/${bounty.maxSlots} slots claimed.`,
  };
}

export default async function BountyDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const bounty = await fetchBountyDetail(id);
  if (!bounty) notFound();

  const tokenMeta = getTokenMeta(bounty.tokenSymbol);
  const isResolved = bounty.status === 1;
  const repo = formatRepoName(bounty.targetRepoUrl);
  const amountDisplay = formatAmount(bounty.amount, bounty.tokenSymbol);
  const deadline = formatDeadline(bounty.deadline);
  const hasWinner = bounty.winner && bounty.winner !== NULL_ADDRESS;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <AuroraBackground />
      <Header />

      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">

        {/* Back */}
        <Link
          href="/bounties"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bounties
        </Link>

        {/* Header card */}
        <div className="premium-panel rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Bounty #{id}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {repo}
              </h1>
            </div>

            {/* Status badge */}
            <span className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold",
              isResolved
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : bounty.isExpired
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-primary/10 text-primary"
            )}>
              {getStatusLabel(bounty.status)}
            </span>
          </div>

          {/* Reward row */}
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2.5">
              <img
                src={tokenMeta.logoUrl}
                alt={bounty.tokenSymbol}
                width={28}
                height={28}
                className="rounded-full"
              />
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {amountDisplay}{" "}
                  <span className={tokenMeta.textColor}>{bounty.tokenSymbol}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ${bounty.amountUsd.toFixed(2)} USD
                </p>
              </div>
            </div>

            <div className="hidden h-8 w-px bg-border sm:block" />

            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {bounty.claimedSlots}/{bounty.maxSlots}
              </span>{" "}
              slots claimed
              {bounty.slotsRemaining > 0 && (
                <span className="ml-2 text-primary">
                  · {bounty.slotsRemaining} open
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {deadline}
            </div>
          </div>

          {/* Links */}
          <div className="mt-6 flex flex-wrap gap-3">
            {bounty.instructionUrl && (
              <a
                href={bounty.instructionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View issue
              </a>
            )}
            {bounty.targetRepoUrl && (
              <a
                href={
                  bounty.targetRepoUrl.startsWith("http")
                    ? bounty.targetRepoUrl
                    : `https://${bounty.targetRepoUrl}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Repository
              </a>
            )}
            <a
              href={`https://celoscan.io/address/${bounty.poster}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Poster on Celoscan
            </a>
          </div>
        </div>

        {/* Two-col grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Left: parameters + winner + claimers */}
          <div className="space-y-6 lg:col-span-1">
            <BountyActionPanel id={id} initialBounty={bounty} />

            {/* Parameters */}
            <div className="premium-panel rounded-2xl p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Parameters
              </h2>
              <dl className="space-y-3 text-sm">
                <DetailRow label="Token" value={bounty.tokenSymbol} />
                <DetailRow
                  label="Stake required"
                  value={`${formatAmount(bounty.stakeRequired, bounty.tokenSymbol)} ${bounty.tokenSymbol}`}
                />
                <DetailRow label="Max slots" value={String(bounty.maxSlots)} />
                <DetailRow
                  label="Bounty type"
                  value={bounty.bountyType === 0 ? "Code" : `Type ${bounty.bountyType}`}
                />
                <DetailRow
                  label="CI required"
                  value={
                    <span className="inline-flex items-center gap-1">
                      {bounty.ciRequired ? (
                        <>
                          <Shield className="h-3.5 w-3.5 text-primary" /> Yes
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" /> No
                        </>
                      )}
                    </span>
                  }
                />
              </dl>
            </div>

            {/* Winner */}
            {hasWinner && (
              <div className="premium-panel rounded-2xl border-emerald-500/20 p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Winner
                </h2>
                <a
                  href={`https://celoscan.io/address/${bounty.winner}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-xs text-primary hover:underline"
                >
                  {bounty.winner}
                </a>
              </div>
            )}

            {/* Claimers */}
            {bounty.claimers.length > 0 && (
              <div className="premium-panel rounded-2xl p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Claimers ({bounty.claimers.length})
                </h2>
                <ul className="space-y-2">
                  {bounty.claimers.map((addr) => (
                    <li key={addr}>
                      <a
                        href={`https://celoscan.io/address/${addr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-xs text-muted-foreground transition hover:text-primary"
                      >
                        {addr.slice(0, 10)}…{addr.slice(-8)}
                      </a>
                      {addr.toLowerCase() === bounty.winner?.toLowerCase() && (
                        <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Winner
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: submissions */}
          <div className="space-y-4 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              <GitPullRequest className="h-4 w-4" />
              Submissions ({bounty.submissions.length})
            </h2>

            {bounty.submissions.length === 0 ? (
              <div className="premium-panel rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">
                No submissions yet.
              </div>
            ) : (
              bounty.submissions.map((sub) => (
                <SubmissionCard
                  key={sub.worker}
                  sub={sub}
                  isWinner={sub.worker.toLowerCase() === bounty.winner?.toLowerCase()}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function SubmissionCard({ sub, isWinner }: { sub: Submission; isWinner: boolean }) {
  let agentMeta: Record<string, string> = {};
  try {
    agentMeta = JSON.parse(sub.metadata) as Record<string, string>;
  } catch {
    /* ignore */
  }

  return (
    <article
      className={cn(
        "premium-panel rounded-2xl p-5 transition",
        isWinner && "border-emerald-500/30 ring-1 ring-emerald-500/20",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs text-muted-foreground">
            {sub.worker.slice(0, 10)}…{sub.worker.slice(-8)}
          </p>
          {agentMeta.agent && (
            <p className="mt-1 text-xs text-muted-foreground">
              Agent:{" "}
              <span className="font-medium text-foreground">{agentMeta.agent}</span>
              {agentMeta.model && (
                <>
                  {" "}
                  · Model:{" "}
                  <span className="font-medium text-foreground">{agentMeta.model}</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isWinner && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Winner
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              isWinner
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400",
            )}
          >
            CI {isWinner ? "passed" : "failed"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {sub.prUrl && (
          <a
            href={sub.prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
          >
            <GitPullRequest className="h-3.5 w-3.5" />
            View PR
          </a>
        )}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 font-mono text-xs text-muted-foreground">
          <GitCommit className="h-3.5 w-3.5" />
          {sub.commitHash.slice(0, 12)}…
        </div>
        {sub.stakeRefunded && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Stake refunded
          </span>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Submitted {formatTimestamp(sub.submittedAt)}
        {agentMeta.sdk && (
          <>
            {" "}
            · SDK: <span className="font-medium">{agentMeta.sdk}</span>
          </>
        )}
      </p>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function getStatusLabel(status: number) {
  if (status === 1) return "Resolved";
  if (status === 2) return "Cancelled";
  return "Open";
}

function formatAmount(amount: string, token: string) {
  const decimals = token === "USDC" ? 6 : 18;
  const float = Number(BigInt(amount)) / 10 ** decimals;
  return float.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatRepoName(targetRepoUrl: string) {
  try {
    const url = new URL(
      targetRepoUrl.startsWith("http") ? targetRepoUrl : `https://${targetRepoUrl}`,
    );
    const parts = url.pathname.replace(/^\/|\/$/g, "").split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : url.hostname;
  } catch {
    return targetRepoUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function formatDeadline(deadline: string) {
  const ts = Number(deadline);
  const date = new Date(ts * 1000);
  if (isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays <= 0) return `Expired ${date.toLocaleDateString()}`;
  if (diffDays === 1) return "1 day left";
  return `${diffDays} days left`;
}

function formatTimestamp(ts: string) {
  const date = new Date(Number(ts) * 1000);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
