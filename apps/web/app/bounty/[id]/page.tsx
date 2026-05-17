import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

// Metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Bounty #${id} | Claudelance`,
    description: "View and interact with a bounty on Claudelance",
  };
}

// B49 page — role-aware bounty detail page
// Three branches:
//   1. Poster + Open + has submissions -> pickWinner UI
//   2. In claimers + no submission yet -> submitPR form
//   3. Otherwise -> claimSlot button (ERC-8004-gated)
export default async function BountyDetailPage({ params }: Props) {
  const { id } = await params;
  const bountyId = parseInt(id, 10);

  if (isNaN(bountyId) || bountyId < 0) notFound();

  // Fetch bounty data from the B45 API
  let bounty: BountyApi | null = null;
  let submissions: SubmissionApi[] = [];
  let error: string | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/bounty/${bountyId}`, {
      next: { revalidate: 30 },
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) notFound();
      throw new Error(`Failed to load bounty: ${res.status}`);
    }

    const data = await res.json();
    bounty = data.bounty ?? null;

    // submissions only available when bounty is resolved / has winner
    if (data.submissions && Array.isArray(data.submissions)) {
      submissions = data.submissions;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  if (error) {
    return (
      <BountyLayout>
        <BountyError message={error} />
      </BountyLayout>
    );
  }

  if (!bounty) {
    return (
      <BountyLayout>
        <BountySkeleton />
      </BountyLayout>
    );
  }

  const status = bounty.status;
  const isOpen = status === 0; // BountyStatus.Open = 0
  const isPoster = false; // Gate with ERC-8004 identity (stub — enable when wagmi provider is in main)
  const hasSubmissions = submissions.length > 0;

  // Determine role branch
  // Branch 1: Poster + Open + has submissions -> pickWinner UI
  // Branch 2: In claimers + no submission yet -> submitPR form
  // Branch 3: Otherwise -> claimSlot button

  return (
    <BountyLayout>
      <BountyHeader bounty={bounty} />

      <div className="mt-6 space-y-6">
        {isPoster && isOpen && hasSubmissions ? (
          <PickWinnerPanel bountyId={bountyId} submissions={submissions} />
        ) : isPoster && isOpen ? (
          <PosterOpenPanel bounty={bounty} />
        ) : isOpen ? (
          <ClaimPanel bounty={bounty} bountyId={bountyId} />
        ) : (
          <BountyStatusBanner status={Number(status)} />
        )}
      </div>
    </BountyLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BountyLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />
      <div className="mx-auto max-w-2xl px-4 py-8">{children}</div>
    </main>
  );
}

function BountyHeader({ bounty }: { bounty: BountyApi }) {
  const tokenSymbol = bounty.tokenSymbol ?? "TOKEN";
  const amount = formatAmount(bounty.amount, bounty.decimals ?? 18);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bounty #{bounty.id}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{bounty.title ?? `Bounty #${bounty.id}`}</h1>
          {bounty.description && (
            <p className="mt-2 text-muted-foreground">{bounty.description}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums">{amount}</p>
          <p className="text-sm text-muted-foreground">{tokenSymbol}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(bounty.status)}`}>
          {statusLabel(bounty.status)}
        </span>
        {bounty.ciRequired && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-200">
            CI Required
          </span>
        )}
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {bounty.claimedSlots ?? 0}/{bounty.maxSlots ?? 0} slots
        </span>
      </div>

      {bounty.targetRepoUrl && (
        <a
          href={bounty.targetRepoUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          {bounty.targetRepoUrl}
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

// Branch 1: Poster + Open + has submissions -> pickWinner UI
function PickWinnerPanel({ bountyId, submissions }: { bountyId: number; submissions: SubmissionApi[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Pick a Winner</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review submissions and select the winning solution.
      </p>

      <div className="mt-4 space-y-3">
        {submissions.map((sub) => (
          <div key={sub.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{sub.worker ?? sub.address}</p>
              {sub.prUrl && (
                <a href={sub.prUrl} target="_blank" rel="noreferrer" className="mt-1 text-sm text-muted-foreground hover:text-foreground">
                  View PR
                </a>
              )}
            </div>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              onClick={() => pickWinner(bountyId, sub.address)}
            >
              Select Winner
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Poster open state (no submissions yet)
function PosterOpenPanel({ bounty }: { bounty: BountyApi }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Your Bounty</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Waiting for workers to submit their solutions.
      </p>
      <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        {bounty.claimedSlots ?? 0} worker(s) have claimed this bounty.
        You will be able to pick a winner once submissions are in.
      </div>
    </div>
  );
}

// Branch 2/3: Claim slot or submit PR
function ClaimPanel({ bounty, bountyId }: { bounty: BountyApi; bountyId: number }) {
  const slotsLeft = (bounty.maxSlots ?? 0) - (bounty.claimedSlots ?? 0);
  const isFull = slotsLeft <= 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Work on this Bounty</h2>

      {isFull ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-200">All slots are filled</p>
          <p className="mt-1 text-muted-foreground">No more slots available for this bounty.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* TODO: Wire wagmi useWriteContract for claimSlot */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Wallet connection will be enabled in a future update.
          </div>
          <button
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            disabled
            title="Requires wagmi provider (coming soon)"
          >
            Claim Slot
          </button>
        </div>
      )}
    </div>
  );
}

function BountyStatusBanner({ status }: { status: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusClass(status)}`}>
        {statusLabel(status)}
      </span>
    </div>
  );
}

function BountyError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
      <p className="font-medium text-red-700 dark:text-red-200">Failed to load bounty</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function BountySkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: string | number | null | undefined, decimals: number = 18): string {
  if (amount == null) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  const divisor = 10 ** decimals;
  return (num / divisor).toFixed(decimals <= 6 ? 2 : decimals);
}

function statusLabel(status: number | string | null | undefined): string {
  const s = Number(status);
  switch (s) {
    case 0: return "Open";
    case 1: return "Resolved";
    case 2: return "Cancelled";
    case 3: return "Expired";
    default: return "Unknown";
  }
}

function statusClass(status: number | string | null | undefined): string {
  const s = Number(status);
  switch (s) {
    case 0:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case 1:
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200";
    case 2:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
    case 3:
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

// Client-side pickWinner action (placeholder — wire to wagmi useWriteContract)
function pickWinner(_bountyId: number, _winnerAddress: string) {
  // TODO: wagmi write contract call
  console.log("pickWinner stub", _bountyId, _winnerAddress);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BountyApi = {
  id?: string | number;
  title?: string;
  description?: string;
  targetRepoUrl?: string;
  instructionUrl?: string;
  token?: string;
  tokenSymbol?: string;
  amount?: string | number;
  decimals?: number;
  deadline?: string | number;
  status?: number | string;
  claimedSlots?: number;
  maxSlots?: number;
  ciRequired?: boolean;
  bountyType?: number;
};

type SubmissionApi = {
  id: string;
  address: string;
  worker?: string;
  prUrl?: string;
  submittedAt?: string;
};