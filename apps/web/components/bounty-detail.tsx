"use client";

import * as React from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2, Lock, ShieldCheck, Upload } from "lucide-react";
import {
  CLAUDELANCE_CORE_ABI,
  CLAUDELANCE_CORE_V3_ABI,
  MAINNET,
  MAINNET_V3,
  TASK_TYPE_NAMES,
  deploymentByChainId,
} from "@yeheskieltame/claudelance-types";
import type { Address, Hash } from "viem";

import { GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransactionToast } from "@/components/transaction-toast";
import { DEFAULT_CHAIN_ID } from "@/lib/chain";
import { formatTokenAmount } from "@/lib/format-token";
import { miniPayFeeCurrency } from "@/lib/wallet/fee-currency";
import { cn, shortAddress } from "@/lib/utils";

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

type Submission = {
  worker: string;
  /** v3: any deliverable URL (PR, Gist, IPFS, etc.) */
  deliverableUrl: string;
  ciPassed: boolean;
  /** v3: keccak256 of deliverable content */
  deliverableHash: string;
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
  bountyType: number;
  status: number;
  ciRequired: boolean;
  targetWorker: string;
  instructionUrl: string;
  targetRepoUrl?: string;
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
  const nowSeconds = Math.floor(Date.now() / 1000);
  const isPastDeadline = Number(bounty.deadline) <= nowSeconds;
  const isOpen = bounty.status === 0 && !isPastDeadline;
  const hasSubmissions = bounty.submissions.length > 0;
  const isDirectHire =
    bounty.targetWorker.toLowerCase() !== "0x0000000000000000000000000000000000000000";
  const isTargetedWorker =
    isConnected && normalizedAddress === bounty.targetWorker.toLowerCase();

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
                  {sub.deliverableUrl && (
                    <a
                      href={sub.deliverableUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View deliverable
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


      {/* Claimer: submit Deliverable */}
      {isClaimer && isOpen && !hasSubmission && (
        <SubmitDeliverableCard bountyId={bounty.id} bountyType={bounty.bountyType} />

      )}

      {/* Worker: claim slot — open bounties, or direct hires only for the targeted worker */}
      {isConnected && !isPoster && !isClaimer && isOpen && (!isDirectHire || isTargetedWorker) && (
        <ClaimSlotCard
          bountyId={bounty.id}
          claimedSlots={bounty.claimedSlots}
          maxSlots={bounty.maxSlots}
          stakeRequired={bounty.stakeRequired}
          token={bounty.token}
        />
      )}

      {/* Direct-hire reserved notice for non-targeted users */}
      {isConnected && !isPoster && !isClaimer && isOpen && isDirectHire && !isTargetedWorker && (
        <GlassCard className="!p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">Reserved for a specific worker</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This direct-hire bounty can only be claimed by its targeted worker, so
            you won&apos;t be able to submit. Browse open bounties instead.
          </p>
          <Button className="mt-4" size="sm" variant="outline" asChild>
            <Link href="/bounties">Browse open bounties</Link>
          </Button>
        </GlassCard>
      )}

      {/* Already submitted notice */}
      {isClaimer && hasSubmission && (
        <GlassCard className="!p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-300">
            You&apos;ve submitted your deliverable. Waiting for the poster to pick a winner.
          </p>
        </GlassCard>
      )}

      {/* Past-deadline state (not yet cancelled/resolved) */}
      {bounty.status === 0 && isPastDeadline && (
        <GlassCard className="!p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This bounty has passed its deadline. The poster can call{" "}
            <code className="text-xs">cancelExpired</code> to recover the escrowed funds.
          </p>
        </GlassCard>
      )}

      {/* Cancelled state */}
      {bounty.status === 2 && (
        <GlassCard className="!p-6 text-center">
          <p className="text-sm text-muted-foreground">This bounty has been cancelled.</p>
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
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: "pickWinner",
        args: [BigInt(bountyId), selected as Address],
        feeCurrency: miniPayFeeCurrency(),
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

// Per-type placeholder hints for the deliverable URL.
const DELIVERABLE_URL_HINT: Record<number, string> = {
  0:  "https://github.com/owner/repo/pull/123",
  1:  "https://gist.github.com/user/abc or ipfs://Qm...",
  2:  "https://gist.github.com/user/abc or https://arweave.net/...",
  3:  "https://gist.github.com/user/abc",
  4:  "https://github.com/owner/repo/pull/123 or gist URL",
  5:  "https://gist.github.com/user/abc (audit report)",
  6:  "https://gist.github.com/user/abc (translated content)",
  7:  "https://gist.github.com/user/abc or https://arweave.net/...",
  8:  "https://gist.github.com/user/abc (legal analysis)",
  9:  "https://gist.github.com/user/abc (financial analysis)",
  10: "https://... (any verifiable URL matching poster spec)",
};

function SubmitDeliverableCard({ bountyId, bountyType = 0 }: { bountyId: string; bountyType?: number }) {
  const getHint = () => {
    switch (bountyType) {
      case 0: return "PR link";
      case 1:
      case 2: return "IPFS/Arweave";
      default: return "URL";
    }
  };

  const getUrlPlaceholder = () => {
    switch (bountyType) {
      case 0: return "https://github.com/owner/repo/pull/123";
      case 1:
      case 2: return "ipfs://... or ar://...";
      default: return "https://...";
    }
  };
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  useTransactionToast(txHash, {
    pendingMessage: "Submitting deliverable",
    confirmedMessage: "Deliverable submitted",
    failedMessage: "Submit failed",
  });

  const [deliverableUrl, setDeliverableUrl] = React.useState("");
  const [contentHash, setContentHash] = React.useState("");
  const core = deploymentByChainId(chainId || DEFAULT_CHAIN_ID)!.core as Address;

  // Validate: URL required; contentHash can be a 40-char commit SHA or 64-char keccak hex.
  const canSubmit = (() => {
    try { new URL(deliverableUrl); } catch { return false; }
    if (!deliverableUrl) return false;
    const h = contentHash.replace(/^0x/, "").toLowerCase();
    return h.length === 40 || h.length === 64;
  })();

  const normalizeHash = (raw: string): `0x${string}` => {
    const h = raw.replace(/^0x/, "").toLowerCase();
    if (h.length === 40) return `0x${h.padEnd(64, "0")}` as `0x${string}`;
    return `0x${h.padStart(64, "0")}` as `0x${string}`;
  };

  const typeName = TASK_TYPE_NAMES[bountyType as keyof typeof TASK_TYPE_NAMES] ?? "Task";

  const submit = async () => {
    if (!canSubmit) return;
    const formattedHash = normalizeHash(contentHash);
    try {
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: "submitDeliverable",
        args: [BigInt(bountyId), deliverableUrl, formattedHash, ""],
        feeCurrency: miniPayFeeCurrency(),
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
          <h3 className="font-semibold">Submit your Deliverable</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ve claimed this bounty. Submit your deliverable URL and
            content hash to complete your entry.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Deliverable URL ({getHint()})</label>
              <input
                type="url"
                placeholder={getUrlPlaceholder()}
                value={deliverableUrl}
                onChange={(e) => setDeliverableUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Content Hash (bytes32)</label>
              <input
                type="text"
                placeholder="Content Hash (hex)"
                value={contentHash}
                onChange={(e) => setContentHash(e.target.value.replace(/^0x/, "").trim())}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button size="sm" onClick={submit} disabled={!canSubmit || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                "Submit Deliverable"
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
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: "settleStake",
        args: [BigInt(bountyId), worker],
        feeCurrency: miniPayFeeCurrency(),
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
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: "withdrawEarnings",
        args: [token as Address],
        feeCurrency: miniPayFeeCurrency(),
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

// Use MAINNET_V3 for tokenMeta lookup (v3 same token addresses as v2 mainnet)
function tokenMeta(tokenAddress: string): { symbol: string; decimals: number } {
  const addr = tokenAddress.toLowerCase();
  if (addr === MAINNET_V3.tokens.USDC.toLowerCase()) return { symbol: "USDC", decimals: 6 };
  if (addr === MAINNET_V3.tokens.cUSD.toLowerCase()) return { symbol: "cUSD", decimals: 18 };
  return { symbol: "CELO", decimals: 18 };
}

function ClaimSlotCard({
  bountyId,
  claimedSlots,
  maxSlots,
  stakeRequired,
  token,
}: {
  bountyId: string;
  claimedSlots: number;
  maxSlots: number;
  stakeRequired: string;
  token: string;
}) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  const [approveHash, setApproveHash] = React.useState<Hash | null>(null);
  useTransactionToast(txHash, {
    pendingMessage: "Claiming slot",
    confirmedMessage: "Slot claimed",
    failedMessage: "Claim failed",
  });
  useTransactionToast(approveHash, {
    pendingMessage: "Approving stake",
    confirmedMessage: "Stake approved",
    failedMessage: "Approval failed",
  });

  const isFull = claimedSlots >= maxSlots;
  const core = deploymentByChainId(chainId || DEFAULT_CHAIN_ID)!.core as Address;
  const { symbol: tokenSymbol, decimals } = tokenMeta(token);
  const stake = BigInt(stakeRequired);
  const stakeFormatted = formatTokenAmount(stake, decimals, 4);

  // claimSlot pulls the stake via transferFrom, so the worker must approve the
  // Core for the stake token first or the claim reverts on insufficient allowance.
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, core] : undefined,
    query: { enabled: Boolean(address) && stake > 0n },
  });
  const { data: approveReceipt } = useWaitForTransactionReceipt({
    hash: approveHash ?? undefined,
  });
  React.useEffect(() => {
    if (approveReceipt?.status === "success") void refetchAllowance();
  }, [approveReceipt, refetchAllowance]);

  const needsApproval =
    stake > 0n && (allowance === undefined || (allowance as bigint) < stake);

  const approve = async () => {
    try {
      const hash = (await writeContractAsync({
        address: token as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [core, stake],
        feeCurrency: miniPayFeeCurrency(),
      })) as Hash;
      setApproveHash(hash);
    } catch {
      // User rejected
    }
  };

  const claim = async () => {
    try {
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: "claimSlot",
        args: [BigInt(bountyId)],
        feeCurrency: miniPayFeeCurrency(),
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
              : `Claim a slot by staking ${stakeFormatted} ${tokenSymbol}. You'll need an ERC-8004 Agent Identity on Celo Mainnet.`}
          </p>
          {!isFull && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {needsApproval && (
                <Button size="sm" variant="outline" onClick={approve} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Approving
                    </>
                  ) : (
                    `Approve ${stakeFormatted} ${tokenSymbol}`
                  )}
                </Button>
              )}
              <Button size="sm" onClick={claim} disabled={isPending || needsApproval}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming
                  </>
                ) : (
                  "Claim slot"
                )}
              </Button>
            </div>
          )}
          {!isFull && needsApproval && allowance !== undefined && (
            <p className="mt-2 text-xs text-muted-foreground">
              Approve the stake token first — claim unlocks once the allowance is confirmed onchain.
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
