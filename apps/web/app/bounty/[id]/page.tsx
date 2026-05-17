import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Coins, GitPullRequest, User, CheckCircle, XCircle, Clock } from "lucide-react";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { cn, shortAddress } from "@/lib/utils";
import { BountyStatus } from "@yeheskieltame/claudelance-types";
import {
  getBountyTokenMeta,
  getBountyTitle,
  getBountyDescription,
  formatDeadlineCountdown,
  formatTokenAmount,
} from "@/components/bounty-card";

type Submission = {
  worker: string;
  commitHash: string;
  submittedAt: string;
  ciPassed: boolean;
  stakeRefunded: boolean;
  prUrl: string;
  metadata: string;
};

type BountyDetail = {
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
  submissions: Submission[];
  total: number;
};

async function getBountyDetail(id: string): Promise<BountyDetail | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/bounty/${id}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

const STATUS_LABELS: Record<number, string> = {
  [BountyStatus.Open]: "Open",
  [BountyStatus.Resolved]: "Resolved",
  [BountyStatus.Cancelled]: "Cancelled",
  [BountyStatus.Expired]: "Expired",
};

const STATUS_STYLES: Record<number, string> = {
  [BountyStatus.Open]: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-200 ring-emerald-500/25",
  [BountyStatus.Resolved]: "bg-sky-500/12 text-sky-700 dark:text-sky-200 ring-sky-500/25",
  [BountyStatus.Cancelled]: "bg-muted text-muted-foreground",
  [BountyStatus.Expired]: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        STATUS_STYLES[status] ?? STATUS_STYLES[BountyStatus.Open],
      )}
    >
      {STATUS_LABELS[status] ?? "Unknown"}
    </span>
  );
}

function ClaimerRow({
  worker,
  submission,
  tokenMeta,
}: {
  worker: string;
  submission: Submission | undefined;
  tokenMeta: ReturnType<typeof getBountyTokenMeta>;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{shortAddress(worker)}</p>
          {submission ? (
            <p className="text-xs text-muted-foreground">
              {submission.prUrl ? (
                <a href={submission.prUrl} target="_blank" rel="noreferrer" className="underline">
                  View PR
                </a>
              ) : (
                "No PR linked"
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No submission yet</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {submission ? (
          <>
            {submission.ciPassed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                <CheckCircle className="h-3 w-3" /> CI Passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-200">
                <Clock className="h-3 w-3" /> Pending
              </span>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3 w-3" /> Waiting
          </span>
        )}
      </div>
    </div>
  );
}

export default async function BountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bounty = await getBountyDetail(id);

  if (!bounty) {
    notFound();
  }

  const tokenMeta = getBountyTokenMeta(bounty.token as `0x${string}`);
  const amountFormatted = formatTokenAmount(BigInt(bounty.amount), tokenMeta.decimals);
  const deadlineTs = BigInt(bounty.deadline);
  const now = Math.floor(Date.now() / 1000);

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />

      <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
        {/* Back link */}
        <Link href="/bounties" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to bounties
        </Link>

        {/* Main card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={bounty.status} />
                <span className="text-xs text-muted-foreground">#{bounty.id}</span>
              </div>
              <h1 className="text-xl font-semibold leading-tight">
                {getBountyTitle({
                  targetRepoUrl: bounty.targetRepoUrl,
                  requirementsHash: bounty.requirementsHash as `0x${string}`,
                })}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {getBountyDescription({
                  instructionUrl: bounty.instructionUrl,
                  requirementsHash: bounty.requirementsHash as `0x${string}`,
                  ciRequired: bounty.ciRequired,
                })}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <Coins className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-lg font-semibold">{amountFormatted}</p>
              <p className="text-xs text-muted-foreground">{tokenMeta.symbol}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <GitPullRequest className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-lg font-semibold">{bounty.claimedSlots}/{bounty.maxSlots}</p>
              <p className="text-xs text-muted-foreground">Slots claimed</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <CalendarClock className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-sm font-semibold">{formatDeadlineCountdown(deadlineTs, now)}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>

          {/* Poster */}
          <div className="mt-5 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">Poster</span>
            <span className="text-sm font-medium">{shortAddress(bounty.poster)}</span>
          </div>

          {/* Action buttons */}
          {bounty.status === BountyStatus.Open && (
            <div className="mt-5 flex gap-3">
              <Button className="flex-1" size="lg">
                Claim this bounty
              </Button>
              {bounty.instructionUrl && (
                <Button variant="outline" size="lg" asChild>
                  <a href={bounty.instructionUrl} target="_blank" rel="noreferrer">
                    View instructions
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Claimers section */}
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold">
            Claimers ({bounty.claimers.length})
          </h2>
          {bounty.claimers.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <User className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No claimers yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bounty.claimers.map((claimer) => {
                const submission = bounty.submissions.find((s) => s.worker === claimer);
                return (
                  <ClaimerRow
                    key={claimer}
                    worker={claimer}
                    submission={submission}
                    tokenMeta={tokenMeta}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Submission details for each claimer */}
        {bounty.submissions.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-base font-semibold">Submissions</h2>
            <div className="space-y-4">
              {bounty.submissions.map((sub) => {
                const submissionWorker = bounty.claimers.find((c) => c === sub.worker);
                return (
                  <div key={sub.worker} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">{shortAddress(sub.worker)}</span>
                      <div className="flex items-center gap-2">
                        {sub.ciPassed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                            <CheckCircle className="h-3 w-3" /> CI Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-200">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                        {sub.stakeRefunded && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            Stake refunded
                          </span>
                        )}
                      </div>
                    </div>
                    {sub.prUrl && (
                      <a
                        href={sub.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <GitPullRequest className="h-4 w-4" />
                        View PR
                      </a>
                    )}
                    {sub.metadata && (
                      <p className="mt-2 text-xs text-muted-foreground">{sub.metadata}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}