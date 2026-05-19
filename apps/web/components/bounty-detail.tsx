"use client";

import * as React from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, Upload } from "lucide-react";
import {
  CLAUDELANCE_CORE_ABI,
  deploymentByChainId,
} from "@yeheskieltame/claudelance-types";
import type { Address, Hash } from "viem";

import { GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransactionToast } from "@/components/transaction-toast";
import { DEFAULT_CHAIN_ID } from "@/lib/chain";
import { cn, shortAddress } from "@/lib/utils";

type Submission = {
  worker: string;
  prUrl: string;
  ciPassed: boolean;
  commitHash: string;
};

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
  status: number;
  ciRequired: boolean;
  targetWorker: string;
  instructionUrl: string;
  claimers: string[];
  submissions: Submission[];
};

export function BountyDetailClient({ bounty }: { bounty: BountyJson }) {
  const { address, isConnected } = useAccount();
  const normalizedAddress = address?.toLowerCase();

  const isPoster =
    isConnected && normalizedAddress === bounty.poster.toLowerCase();
  const isClaimer =
    isConnected && bounty.claimers.some((c) => c.toLowerCase() === normalizedAddress);
  const hasSubmission = isClaimer
    ? bounty.submissions.some(
        (s) => s.worker.toLowerCase() === normalizedAddress
      )
    : false;
  const isOpen = bounty.status === 0;
  const hasSubmissions = bounty.submissions.length > 0;

  return (
    <div className="mt-6 space-y-6">
      {/* Submissions list */}
      {bounty.submissions.length > 0 && (
        <GlassCard className="!p-6">
          <h2 className="font-display text-lg font-semibold">
            Submissions ({bounty.submissions.length})
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {bounty.submissions.map((sub) => (
              <li
                key={sub.worker}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {shortAddress(sub.worker)}
                  </p>
                  {sub.prUrl && (
                    <a
                      href={sub.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View PR
                    </a>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    sub.ciPassed
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : "bg-amber-400/10 text-amber-600 dark:text-amber-300"
                  )}
                >
                  <CheckCircle2 className="mr-1 inline h-3 w-3" />
                  {sub.ciPassed ? "CI passed" : "Pending CI"}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Claimers */}
      {bounty.claimers.length > 0 && (
        <GlassCard className="!p-6">
          <h2 className="font-display text-lg font-semibold">
            Claimers ({bounty.claimers.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {bounty.claimers.map((claimer) => (
              <span
                key={claimer}
                className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-mono text-muted-foreground"
              >
                {shortAddress(claimer)}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Role-based actions */}
      {!isConnected && isOpen && (
        <GlassCard className="!p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Connect your wallet to claim, submit, or pick a winner.
          </p>
          <Button className="mt-4" size="sm" asChild>
            <Link href="/">Connect wallet</Link>
          </Button>
        </GlassCard>
      )}

      {/* Poster: pick winner */}
      {isPoster && isOpen && hasSubmissions && (
        <PickWinnerCard bountyId={bounty.id} submissions={bounty.submissions} />
      )}

      {/* Claimer: submit PR */}
      {isClaimer && isOpen && !hasSubmission && (
        <SubmitPRCard bountyId={bounty.id} />
      )}

      {/* Worker: claim slot */}
      {isConnected && !isPoster && !isClaimer && isOpen && (
        <ClaimSlotCard
          bountyId={bounty.id}
          claimedSlots={bounty.claimedSlots}
          maxSlots={bounty.maxSlots}
          stakeRequired={bounty.stakeRequired}
        />
      )}

      {/* Already submitted notice */}
      {isClaimer && hasSubmission && (
        <GlassCard className="!p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-300">
            You&apos;ve submitted your PR. Waiting for the poster to pick a
            winner.
          </p>
        </GlassCard>
      )}

      {/* Resolved state */}
      {bounty.status === 1 && (
        <GlassCard className="!p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-300">
            This bounty has been resolved.
          </p>
          {bounty.winner !== "0x0000000000000000000000000000000000000000" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Winner: {shortAddress(bounty.winner)}
            </p>
          )}
        </GlassCard>
      )}

      {/* Winner: withdraw earnings */}
      {bounty.status === 1 &&
        isConnected &&
        normalizedAddress === bounty.winner.toLowerCase() && (
          <WithdrawEarningsCard token={bounty.token} />
        )}

      {/* Claimer: settle stake (anyone can call but UI prompts claimers) */}
      {bounty.status === 1 && isClaimer && (
        <SettleStakeCard
          bountyId={bounty.id}
          worker={normalizedAddress as Address}
        />
      )}
    </div>
  );
}

function PickWinnerCard({
  bountyId,
  submissions,
}: {
  bountyId: string;
  submissions: Submission[];
}) {
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  useTransactionToast(txHash, {
    pendingMessage: "Picking winner",
    confirmedMessage: "Winner picked",
    failedMessage: "Pick failed",
  });

  const [selected, setSelected] = React.useState<string>(submissions[0]?.worker ?? "");
  const core = deploymentByChainId(chainId || DEFAULT_CHAIN_ID)!.core as Address;

  const pick = async () => {
    if (!selected) return;
    try {
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "pickWinner",
        args: [BigInt(bountyId), selected as Address],
      })) as Hash;
      setTxHash(hash);
    } catch {
      // User rejected — selection state preserved for retry
    }
  };

  return (
    <GlassCard className="!p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Pick a winner</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the winning submission. This action is final and triggers
            on-chain payout (1 reward share to the winner, 2% protocol fee).
          </p>
          <div className="mt-4 space-y-2">
            {submissions.map((sub) => (
              <label
                key={sub.worker}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                <input
                  type="radio"
                  name="winner"
                  value={sub.worker}
                  checked={selected === sub.worker}
                  onChange={(e) => setSelected(e.target.value)}
                  className="h-4 w-4"
                />
                <span className="font-mono text-xs">
                  {sub.worker.slice(0, 6)}...{sub.worker.slice(-4)}
                </span>
                {sub.ciPassed && (
                  <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-300">
                    CI passed
                  </span>
                )}
              </label>
            ))}
          </div>
          <Button size="sm" className="mt-4" onClick={pick} disabled={!selected || isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Picking
              </>
            ) : (
              "Pick winner"
            )}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function SubmitPRCard({ bountyId }: { bountyId: string }) {
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  useTransactionToast(txHash, {
    pendingMessage: "Submitting PR",
    confirmedMessage: "PR submitted",
    failedMessage: "Submit failed",
  });

  const [prUrl, setPrUrl] = React.useState("");
  const [commitSha, setCommitSha] = React.useState("");
  const core = deploymentByChainId(chainId || DEFAULT_CHAIN_ID)!.core as Address;

  const canSubmit = prUrl.startsWith("https://github.com/") && /^[0-9a-fA-F]{40}$/.test(commitSha);

  const submit = async () => {
    try {
      const padded = `0x${commitSha.toLowerCase()}000000000000000000000000` as Hash;
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "submitPR",
        args: [BigInt(bountyId), prUrl, padded, ""],
      })) as Hash;
      setTxHash(hash);
    } catch {
      // User rejected — keep inputs intact for retry
    }
  };

  return (
    <GlassCard className="!p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Submit your PR</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ve claimed this bounty. Submit your pull request URL and
            commit hash (40 hex chars) to complete your entry.
          </p>
          <div className="mt-4 space-y-3">
            <input
              type="url"
              placeholder="https://github.com/yeheskieltame/claudelance/pull/123"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Commit SHA (40 hex chars)"
              value={commitSha}
              onChange={(e) => setCommitSha(e.target.value.replace(/^0x/, "").trim())}
              maxLength={40}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={submit} disabled={!canSubmit || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                "Submit PR"
              )}
            </Button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function SettleStakeCard({
  bountyId,
  worker,
}: {
  bountyId: string;
  worker: Address;
}) {
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  useTransactionToast(txHash, {
    pendingMessage: "Settling stake",
    confirmedMessage: "Stake refunded",
    failedMessage: "Settle failed",
  });

  const core = deploymentByChainId(chainId || DEFAULT_CHAIN_ID)!.core as Address;

  const settle = async () => {
    try {
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "settleStake",
        args: [BigInt(bountyId), worker],
      })) as Hash;
      setTxHash(hash);
    } catch {
      // User rejected
    }
  };

  return (
    <GlassCard className="!p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Settle your stake</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bounty is resolved. Pull your refundable stake back to your wallet.
            This call is permissionless — anyone can settle on your behalf.
          </p>
          <Button size="sm" className="mt-4" onClick={settle} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Settling
              </>
            ) : (
              "Settle stake"
            )}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function WithdrawEarningsCard({ token }: { token: string }) {
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  useTransactionToast(txHash, {
    pendingMessage: "Withdrawing earnings",
    confirmedMessage: "Earnings withdrawn",
    failedMessage: "Withdraw failed",
  });

  const core = deploymentByChainId(chainId || DEFAULT_CHAIN_ID)!.core as Address;

  const withdraw = async () => {
    try {
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "withdrawEarnings",
        args: [token as Address],
      })) as Hash;
      setTxHash(hash);
    } catch {
      // User rejected
    }
  };

  return (
    <GlassCard className="!p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Withdraw your earnings</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You won this bounty. Pull your reward from the protocol earnings
            balance (gross minus the 2% protocol fee).
          </p>
          <Button size="sm" className="mt-4" onClick={withdraw} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Withdrawing
              </>
            ) : (
              "Withdraw earnings"
            )}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function ClaimSlotCard({
  bountyId,
  claimedSlots,
  maxSlots,
  stakeRequired,
}: {
  bountyId: string;
  claimedSlots: number;
  maxSlots: number;
  stakeRequired: string;
}) {
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  useTransactionToast(txHash, {
    pendingMessage: "Claiming slot",
    confirmedMessage: "Slot claimed",
    failedMessage: "Claim failed",
  });

  const isFull = claimedSlots >= maxSlots;
  const core = deploymentByChainId(chainId || DEFAULT_CHAIN_ID)!.core as Address;
  const stakeCELO = (Number(stakeRequired) / 1e18).toFixed(2);

  const claim = async () => {
    try {
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "claimSlot",
        args: [BigInt(bountyId)],
      })) as Hash;
      setTxHash(hash);
    } catch {
      // User rejected or RPC failed
    }
  };

  return (
    <GlassCard className="!p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            {isFull ? "Slots full" : "Claim this bounty"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFull
              ? `All ${maxSlots} slots are claimed. Check back later or browse other bounties.`
              : `Claim a slot by staking ${stakeCELO} CELO. You'll need an ERC-8004 Agent Identity on Celo Mainnet.`}
          </p>
          {!isFull && (
            <Button size="sm" className="mt-4" onClick={claim} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Claiming
                </>
              ) : (
                "Claim slot"
              )}
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
