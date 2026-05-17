"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { GitPullRequest, CheckCircle2, Loader2 } from "lucide-react";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";
import { BountyStatus } from "@yeheskieltame/claudelance-types";

type BountyDetail = {
  id: string;
  poster: `0x${string}`;
  amount: string;
  stakeRequired: string;
  token: `0x${string}`;
  deadline: string;
  maxSlots: number;
  claimedSlots: number;
  ciRequired: boolean;
  status: number;
  targetRepoUrl: string;
  instructionUrl: string;
  claimers: `0x${string}`[];
  submissions: Array<{
    worker: `0x${string}`;
    prUrl: string;
    ciPassed: boolean;
    submittedAt: string;
  }>;
};

const STATUS_LABELS: Record<number, string> = {
  [BountyStatus.Open]: "Open",
  [BountyStatus.Resolved]: "Resolved",
  [BountyStatus.Cancelled]: "Cancelled",
  [BountyStatus.Expired]: "Expired",
};

export default function BountyDetailPage() {
  const params = useParams<{ id: string }>();
  const bountyId = params.id;

  const { address } = useAccount();
  const [bounty, setBounty] = React.useState<BountyDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [prUrl, setPrUrl] = React.useState("");

  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const isConnected = !!address;
  const isPoster = bounty ? address?.toLowerCase() === bounty.poster.toLowerCase() : false;
  const mySubmission = bounty?.submissions.find(
    (s) => address && s.worker.toLowerCase() === address.toLowerCase(),
  );
  const hasSubmitted = !!mySubmission;
  const slotsFull = bounty ? bounty.claimedSlots >= bounty.maxSlots : false;
  const isOpen = bounty?.status === BountyStatus.Open;
  const myPrUrl = mySubmission?.prUrl;

  React.useEffect(() => {
    if (!bountyId) return;
    fetch(`/api/bounty/${bountyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setBounty(d);
        }
      })
      .catch(() => setError("Failed to load bounty"))
      .finally(() => setLoading(false));
  }, [bountyId]);

  const handleClaim = () => {
    // TODO: integrate postBountyClaimSlot write contract
    alert("claimSlot not yet wired — coming in a follow-up PR");
  };

  const handleSubmitPR = () => {
    if (!prUrl || !prUrl.includes("github.com")) {
      alert("Enter a valid GitHub PR URL");
      return;
    }
    // TODO: integrate submitWork write contract
    alert(`submitWork not yet wired — PR: ${prUrl}`);
  };

  const handlePickWinner = (worker: `0x${string}`) => {
    // TODO: integrate resolveBounty write contract
    alert(`resolveBounty not yet wired — winner: ${worker}`);
  };

  if (loading) {
    return (
      <BountyShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </BountyShell>
    );
  }

  if (error || !bounty) {
    return (
      <BountyShell>
        <GlassCard className="!p-8 text-center">
          <p className="text-destructive">{error ?? "Bounty not found"}</p>
        </GlassCard>
      </BountyShell>
    );
  }

  const tokenSymbol = bounty.token === "0x765de816845861e75a25fca122bb6898b8b1282a" ? "cUSD"
    : bounty.token === "0x471ece3750da237f93b8e339c536989b8978a438" ? "CELO"
    : "USDC";

  return (
    <BountyShell>
      <div className="mx-auto w-full max-w-2xl px-4 pb-24">
        {/* Header card */}
        <GlassCard className="mb-4 !p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    isOpen
                      ? "bg-green-500/20 text-green-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {STATUS_LABELS[bounty.status] ?? "Unknown"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">#{bounty.id}</span>
              </div>
              <h1 className="font-display text-2xl font-semibold">
                {bounty.amount} {tokenSymbol}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {bounty.claimedSlots}/{bounty.maxSlots} slots claimed
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-muted-foreground">Stake required</p>
              <p className="font-semibold">{bounty.stakeRequired} CELO</p>
            </div>
          </div>

          {/* Links */}
          <div className="mt-4 flex flex-col gap-2">
            {bounty.targetRepoUrl && (
              <a
                href={bounty.targetRepoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Repository
              </a>
            )}
            {bounty.instructionUrl && (
              <a
                href={bounty.instructionUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Issue / Instructions
              </a>
            )}
          </div>
        </GlassCard>

        {/* Action section */}
        <GlassCard className="!p-6">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground">Connect your wallet to participate</p>
              <WalletButton />
            </div>
          ) : isPoster && isOpen && bounty.submissions.length > 0 ? (
            <>
              <h2 className="mb-4 font-semibold">Submissions</h2>
              {bounty.submissions.map((sub) => (
                <div
                  key={sub.worker}
                  className="mb-3 flex items-center justify-between rounded-2xl border border-border p-4"
                >
                  <div className="flex items-center gap-2">
                    {sub.ciPassed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <GitPullRequest className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-mono text-xs">{sub.worker.slice(0, 8)}…</p>
                      {sub.prUrl && (
                        <a
                          href={sub.prUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View PR
                        </a>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePickWinner(sub.worker as `0x${string}`)}
                  >
                    Pick winner
                  </Button>
                </div>
              ))}
            </>
          ) : hasSubmitted ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="font-medium">PR submitted</p>
              {hasSubmitted && myPrUrl && (
                <a
                  href={myPrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View your PR
                </a>
              )}
            </div>
          ) : isOpen && !slotsFull ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Claim a slot and submit your PR to compete for this bounty.
              </p>
              {!hasSubmitted && (
                <Button onClick={handleClaim} className="w-full">
                  Claim Slot
                </Button>
              )}
              {hasSubmitted && !myPrUrl && (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://github.com/owner/repo/pull/123"
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                  <Button onClick={handleSubmitPR} disabled={isWriting || isConfirming} className="w-full">
                    {isWriting || isConfirming ? "Confirming…" : "Submit PR"}
                  </Button>
                </div>
              )}
            </div>
          ) : slotsFull && isOpen ? (
            <p className="text-center text-sm text-muted-foreground">All slots are full.</p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              This bounty is no longer accepting submissions.
            </p>
          )}
        </GlassCard>
      </div>
    </BountyShell>
  );
}

function BountyShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />
      <Header />
      <div className="pt-8">{children}</div>
    </main>
  );
}