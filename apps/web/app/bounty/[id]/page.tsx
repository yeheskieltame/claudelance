"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Coins, ExternalLink, GitPullRequest, Loader2, ShieldCheck, Users } from "lucide-react";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BountyDetail = {
  id: string;
  amount: string;
  stakeRequired: string;
  token: string;
  deadline: string;
  maxSlots: number;
  claimedSlots: number;
  ciRequired: boolean;
  status: number | string;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash: string;
  claimers?: string[];
  submissions?: Array<{ worker: string; prUrl: string; ciPassed: boolean; submittedAt: string }>;
};

const STATUS_LABELS: Record<number, string> = {
  0: "Open",
  1: "Claimed",
  2: "Submitted",
  3: "Resolved",
  4: "Cancelled",
  5: "Expired",
};

export default function BountyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [bounty, setBounty] = React.useState<BountyDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/bounty/${id}`, { headers: { accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        return response.json() as Promise<BountyDetail>;
      })
      .then((data) => {
        if (!cancelled) setBounty(data);
      })
      .catch(() => {
        if (!cancelled) setError("Bounty details are not available yet.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />
      <Header />

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-24 pt-10 sm:pt-14">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/bounties">
            <ArrowLeft className="h-4 w-4" />
            Back to bounties
          </Link>
        </Button>

        {isLoading ? <LoadingState /> : null}
        {error ? <StateCard title="Unable to load bounty" description={error} /> : null}
        {!isLoading && !error && bounty ? <BountyContent bounty={bounty} /> : null}
      </section>
    </main>
  );
}

function BountyContent({ bounty }: { bounty: BountyDetail }) {
  const title = deriveTitle(bounty);
  const description = bounty.instructionUrl || bounty.targetRepoUrl || "Review requirements and submit a pull request.";
  const status = formatStatus(bounty.status);
  const submissions = bounty.submissions ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <article className="rounded-3xl border border-border bg-card/85 p-6 shadow-sm backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/10 text-primary ring-primary/20">Bounty #{bounty.id}</Badge>
          <Badge className={status === "Resolved" ? "bg-emerald-500/12 text-emerald-600 ring-emerald-500/20" : "bg-amber-400/15 text-amber-800 ring-amber-400/30"}>{status}</Badge>
        </div>

        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <InfoTile icon={<Coins />} label="Reward" value={`${formatAmount(bounty.amount)} TOKEN`} />
          <InfoTile icon={<ShieldCheck />} label="Stake required" value={`${formatAmount(bounty.stakeRequired)} TOKEN`} />
          <InfoTile icon={<CalendarClock />} label="Deadline" value={formatDeadline(bounty.deadline)} />
          <InfoTile icon={<Users />} label="Slots claimed" value={`${bounty.claimedSlots} / ${bounty.maxSlots}`} />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {bounty.instructionUrl ? <ExternalButton href={bounty.instructionUrl}>View requirements</ExternalButton> : null}
          {bounty.targetRepoUrl ? <ExternalButton href={bounty.targetRepoUrl}>Open repository</ExternalButton> : null}
        </div>
      </article>

      <aside className="flex flex-col gap-4">
        <div className="rounded-3xl border border-border bg-card/85 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-semibold tracking-tight">Review checklist</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <ChecklistItem>Read the linked requirements.</ChecklistItem>
            <ChecklistItem>{bounty.ciRequired ? "CI is required before review." : "Manual review is accepted."}</ChecklistItem>
            <ChecklistItem>Submit a PR before the deadline.</ChecklistItem>
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card/85 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-semibold tracking-tight">Submissions</h2>
          {submissions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {submissions.map((submission) => (
                <a key={`${submission.worker}-${submission.prUrl}`} href={submission.prUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 p-3 text-sm transition hover:border-primary/40">
                  <span className="min-w-0 truncate">{shortAddress(submission.worker)}</span>
                  <span className="inline-flex items-center gap-1 text-primary">
                    PR
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-3xl border border-border bg-card/80 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading bounty details
    </div>
  );
}

function StateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card/80 p-8 text-center shadow-sm backdrop-blur">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactElement<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {React.cloneElement(icon, { className: "h-4 w-4 text-foreground" })}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{children}</span>;
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild>
      <a href={href} target="_blank" rel="noreferrer">
        {children}
        <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  );
}

function deriveTitle(bounty: BountyDetail) {
  const repo = formatRepoName(bounty.targetRepoUrl);
  return repo ? `${repo} bounty` : `Bounty ${bounty.id}`;
}

function formatRepoName(value: string) {
  try {
    const url = new URL(value);
    const [owner, repo] = url.pathname.replace(/^\/|\/$/g, "").split("/");
    return owner && repo ? `${owner}/${repo}` : url.hostname;
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^\/|\/$/g, "");
  }
}

function formatStatus(status: string | number) {
  const numeric = Number(status);
  return STATUS_LABELS[numeric] ?? String(status);
}

function formatDeadline(value: string) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "No deadline";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(seconds * 1000));
}

function formatAmount(value: string) {
  try {
    const amount = BigInt(value);
    const base = 10n ** 18n;
    const whole = amount / base;
    const fraction = amount % base;
    const decimal = fraction.toString().padStart(18, "0").slice(0, 2).replace(/0+$/, "");
    return decimal ? `${whole}.${decimal}` : whole.toString();
  } catch {
    return value;
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
