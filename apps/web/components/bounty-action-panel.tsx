"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  ExternalLink,
  GitPullRequest,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type BountyDetail } from "@/lib/fetch-bounty-detail";
import { celoMainnet, celoSepolia } from "@/lib/chain";
import { MAINNET, SEPOLIA, coreAbi } from "@/lib/contracts";

const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable"
  }
] as const;

const erc721Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  }
] as const;

// PR Form Validation Zod Schema
const prFormSchema = z.object({
  prUrl: z.string()
    .url("Must be a valid URL")
    .refine(
      (val) => val.includes("github.com") && val.includes("/pull/"),
      "Must be a valid GitHub Pull Request URL"
    ),
  commitHash: z.string()
    .min(7, "Commit hash must be at least 7 characters")
    .refine(
      (val) => {
        const clean = val.replace(/^0x/, "");
        return /^[0-9a-fA-F]+$/.test(clean);
      },
      "Commit hash must be a valid hexadecimal string"
    ),
  metadata: z.string().optional(),
});

export function BountyActionPanel({
  id,
  initialBounty,
}: {
  id: string;
  initialBounty: BountyDetail;
}) {
  const router = useRouter();
  const publicClient = usePublicClient();
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const connectors = useConnectors();
  const { writeContractAsync } = useWriteContract();

  // Dynamic state that syncs with API fetches after mutations
  const [bounty, setBounty] = React.useState<BountyDetail>(initialBounty);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Form states for Branch 2 (Submit PR)
  const [prUrl, setPrUrl] = React.useState("");
  const [commitHash, setCommitHash] = React.useState("");
  const [metadata, setMetadata] = React.useState(
    JSON.stringify(
      { agent: "Claude Code Client", sdk: "Claudelance v2", model: "Sonnet 3.5" },
      null,
      2
    )
  );
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [isSubmittingPR, setIsSubmittingPR] = React.useState(false);

  // States for Branch 1 (Pick Winner)
  const [selectedWinner, setSelectedWinner] = React.useState<string>("");
  const [isPickingWinner, setIsPickingWinner] = React.useState(false);

  // General loader state
  const [isActionPending, setIsActionPending] = React.useState(false);

  // Resolve deployment records
  const chainId = chain?.id ?? celoSepolia.id;
  const deployment = chainId === celoMainnet.id ? MAINNET : SEPOLIA;

  // ERC-8004 Gating variables
  const identityRegistryAddress =
    chainId === celoMainnet.id
      ? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
      : "0x8004A818BFB912233c491871b3d84c89A494BD9e";

  // Fetch updated bounty state from /api/bounty/[id]
  const refreshBountyState = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/bounty/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBounty(data);
      }
    } catch (e) {
      console.error("Failed to refresh bounty:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [id]);

  // Wagmi Read contract checks (Allowance + Identity)
  const { data: rawAllowance, refetch: refetchAllowance } = useReadContract({
    address: bounty.token as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: isConnected && address ? [address, deployment.core as Address] : undefined,
    query: {
      enabled: isConnected && !!address && !!bounty.token,
    },
  });

  const { data: rawIdentityBalance, refetch: refetchIdentity } = useReadContract({
    address: identityRegistryAddress as Address,
    abi: erc721Abi,
    functionName: "balanceOf",
    args: isConnected && address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Derived state values
  const hasSubmissions = bounty.submissions.length > 0;
  const isPoster = isConnected && address && bounty.poster.toLowerCase() === address.toLowerCase();
  const isClaimer = isConnected && address && bounty.claimers.some((c) => c.toLowerCase() === address.toLowerCase());
  const hasSubmitted = isConnected && address && bounty.submissions.some((s) => s.worker.toLowerCase() === address.toLowerCase());

  const allowance = rawAllowance ?? 0n;
  const identityBalance = rawIdentityBalance ?? 0n;
  const hasIdentity = identityBalance > 0n;

  const stakeRequiredBigInt = BigInt(bounty.stakeRequired);
  const needsApproval = isConnected && stakeRequiredBigInt > 0n && allowance < stakeRequiredBigInt;

  // PR commit hash SHA-1 to bytes32 helper
  function formatCommitHash(input: string): `0x${string}` {
    let clean = input.trim();
    if (clean.startsWith("0x")) clean = clean.slice(2);
    // Pad to 64 characters (32 bytes) with trailing zeros
    clean = clean.padEnd(64, "0");
    return `0x${clean.slice(0, 64)}` as `0x${string}`;
  }

  // --- ACTIONS ---

  // Handle Token Approval
  const handleApprove = async () => {
    if (!isConnected) return;
    setIsActionPending(true);
    const toastId = toast.loading("Approving bounty stake spend...");

    try {
      const tx = await writeContractAsync({
        address: bounty.token as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.core as Address, stakeRequiredBigInt],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      toast.success("Allowance approved successfully!", { id: toastId });
      refetchAllowance();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve spend.", { id: toastId });
    } finally {
      setIsActionPending(false);
    }
  };

  // Handle claimSlot call
  const handleClaimSlot = async () => {
    if (!isConnected) return;
    setIsActionPending(true);
    const toastId = toast.loading("Claiming worker slot on-chain...");

    try {
      const tx = await writeContractAsync({
        address: deployment.core as Address,
        abi: coreAbi,
        functionName: "claimSlot",
        args: [BigInt(bounty.id)],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      toast.success("Slot claimed! You are officially onboarded.", { id: toastId });
      await refreshBountyState();
      refetchIdentity();
      refetchAllowance();
    } catch (e: any) {
      toast.error(e.message || "Failed to claim slot.", { id: toastId });
    } finally {
      setIsActionPending(false);
    }
  };

  // Handle submitPR Form Submission
  const handleSubmitPR = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = prFormSchema.safeParse({ prUrl, commitHash, metadata });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    setIsSubmittingPR(true);
    const toastId = toast.loading("Submitting Pull Request on-chain...");

    try {
      const tx = await writeContractAsync({
        address: deployment.core as Address,
        abi: coreAbi,
        functionName: "submitPR",
        args: [
          BigInt(bounty.id),
          prUrl,
          formatCommitHash(commitHash),
          metadata,
        ],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      toast.success("Pull Request registered on-chain!", { id: toastId });
      setPrUrl("");
      setCommitHash("");
      await refreshBountyState();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit PR.", { id: toastId });
    } finally {
      setIsSubmittingPR(false);
    }
  };

  // Handle pickWinner Poster Call
  const handlePickWinner = async () => {
    if (!selectedWinner) {
      toast.error("Please select a worker first.");
      return;
    }

    setIsPickingWinner(true);
    const toastId = toast.loading("Releasing escrow to winner on-chain...");

    try {
      const tx = await writeContractAsync({
        address: deployment.core as Address,
        abi: coreAbi,
        functionName: "pickWinner",
        args: [BigInt(bounty.id), selectedWinner as Address],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      toast.success("Bounty resolved! Winner paid in full.", { id: toastId });
      await refreshBountyState();
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve bounty.", { id: toastId });
    } finally {
      setIsPickingWinner(false);
    }
  };

  // --- VIEW RENDERING ENGINE ---

  // Gating status messages
  const isResolved = bounty.status === 1;
  const isCancelled = bounty.status === 2;

  // Header render block
  const renderHeader = (label: string, icon: React.ReactNode) => (
    <div className="flex items-center gap-2 mb-4 border-b border-border/60 pb-3">
      {icon}
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </h3>
    </div>
  );

  // Gated states (Resolved or Cancelled)
  if (isResolved) {
    return (
      <div className="premium-panel rounded-2xl p-6 border-emerald-500/20 text-center">
        <Trophy className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-base font-bold">This bounty is Resolved</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          The poster has successfully reviewed all PR submissions, verified CI, and released the escrow payout to the winning builder.
        </p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="premium-panel rounded-2xl p-6 border-red-500/20 text-center">
        <Lock className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-bold">This bounty is Cancelled</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          This escrow contract has been cancelled and closed. No further claims or submissions are allowed.
        </p>
      </div>
    );
  }

  // BRANCH 1: Poster + Open + Has Submissions -> pickWinner UI
  if (isPoster && hasSubmissions) {
    return (
      <div className="premium-panel rounded-2xl p-6">
        {renderHeader("Bounty Management Dashboard", <Shield className="h-4.5 w-4.5 text-primary" />)}
        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
          Select an onboarded worker's submission to approve the pull request, release locked escrow funds, and award the bounty.
        </p>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground/80">
              Select Winning Worker
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {bounty.submissions.map((sub) => {
                const selected = selectedWinner === sub.worker;
                return (
                  <button
                    key={sub.worker}
                    type="button"
                    onClick={() => setSelectedWinner(sub.worker)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all text-xs flex items-center justify-between",
                      selected
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                        : "border-border bg-card/40 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-mono font-bold break-all">
                        {sub.worker.slice(0, 12)}…{sub.worker.slice(-10)}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        <GitPullRequest className="h-3 w-3" />
                        {sub.prUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                      </span>
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0",
                      sub.ciPassed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}>
                      CI {sub.ciPassed ? "Passed" : "Failed"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handlePickWinner}
            disabled={!selectedWinner || isPickingWinner}
            className="w-full font-semibold shadow-glow btn-shine gap-2 mt-2"
          >
            {isPickingWinner ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resolving Escrow...
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4" />
                Pick Selected Winner & Release Escrow
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // BRANCH 2: In claimers + no submission yet -> submitPR form
  if (isClaimer && !hasSubmitted) {
    return (
      <div className="premium-panel rounded-2xl p-6">
        {renderHeader("File Bounty Submission", <GitPullRequest className="h-4.5 w-4.5 text-primary" />)}
        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
          Submit your completed PR URL and exact commit hash. Your stake will be refunded upon a successful on-chain CI attestation.
        </p>

        <form onSubmit={handleSubmitPR} className="space-y-4">
          {/* PR URL Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/80">
              GitHub Pull Request URL
            </label>
            <input
              type="text"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              className={cn(
                "w-full rounded-xl border bg-card/60 px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary",
                formErrors.prUrl ? "border-destructive/80 focus:ring-destructive" : "border-border"
              )}
            />
            {formErrors.prUrl && (
              <span className="text-[10px] text-destructive font-semibold">
                {formErrors.prUrl}
              </span>
            )}
          </div>

          {/* Commit Hash Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/80">
              Commit Hash (Git SHA)
            </label>
            <input
              type="text"
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
              placeholder="40-character SHA-1 hash (e.g. 7f9c39f...)"
              className={cn(
                "w-full rounded-xl border bg-card/60 px-4 py-2.5 text-xs font-medium font-mono focus:outline-none focus:ring-1 focus:ring-primary",
                formErrors.commitHash ? "border-destructive/80 focus:ring-destructive" : "border-border"
              )}
            />
            {formErrors.commitHash && (
              <span className="text-[10px] text-destructive font-semibold">
                {formErrors.commitHash}
              </span>
            )}
          </div>

          {/* Metadata Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/80">
              Agent Submission Metadata (JSON)
            </label>
            <textarea
              rows={3}
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              className="w-full rounded-xl border border-border bg-card/60 px-4 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmittingPR}
            className="w-full font-semibold shadow-glow btn-shine gap-2 mt-2"
          >
            {isSubmittingPR ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Filing PR on-chain...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Submit Pull Request
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  // BRANCH 3: Otherwise -> claimSlot button (ERC-8004 identity-gated)

  // 1. Account not connected
  if (!isConnected || !address) {
    const injectedConnector =
      connectors.find((c) => c.id === "injected") ?? connectors[0];
    return (
      <div className="premium-panel rounded-2xl p-6 text-center border-dashed">
        <Wallet className="h-10 w-10 text-primary mx-auto mb-3" />
        <h3 className="text-base font-bold">Participate in Bounty</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto mb-5">
          Connect your Web3 Celo wallet to check your developer credentials, claim open worker slots, or file pull requests.
        </p>
        <Button
          onClick={() => injectedConnector && connect({ connector: injectedConnector })}
          className="font-semibold shadow-glow gap-1.5 px-6 rounded-full"
        >
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
      </div>
    );
  }

  // 2. Already Claimed + PR Submitted
  if (hasSubmitted) {
    return (
      <div className="premium-panel rounded-2xl p-6 border-emerald-500/10 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-base font-bold">PR Filed Successfully</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          You have already claimed a slot and submitted your pull request. Your work is currently waiting for the project owner to review, test, and release the locked escrow payout.
        </p>
      </div>
    );
  }

  // 3. Checked Expired or slots filled
  if (bounty.slotsRemaining === 0) {
    return (
      <div className="premium-panel rounded-2xl p-6 border-red-500/15 text-center">
        <Users className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-base font-bold">Slots Are Full</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          All of the maximum {bounty.maxSlots} worker slots for this bounty are currently occupied. Check out other open marketplace listings!
        </p>
      </div>
    );
  }

  if (bounty.isExpired) {
    return (
      <div className="premium-panel rounded-2xl p-6 border-red-500/15 text-center">
        <Lock className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-base font-bold">Bounty Deadline Expired</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          The deadline for this escrow contract has passed. This bounty is locked for new participants.
        </p>
      </div>
    );
  }

  // 4. ERC-8004 Gating (No Identity Token)
  if (!hasIdentity) {
    return (
      <div className="premium-panel rounded-2xl p-6 border-amber-500/25">
        <div className="flex gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Worker Identity Registry Gated
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
              Claudelance uses **ERC-8004 Identity Registry** standards to verify autonomous developers and agents.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold leading-relaxed mt-2">
              Your wallet address ({address.slice(0, 8)}…{address.slice(-6)}) does not currently hold a verified ERC-8004 Identity NFT.
            </p>
          </div>
        </div>
        <Button disabled className="w-full mt-5 font-semibold text-xs rounded-xl">
          Slot Gated: Lacks ERC-8004 Identity
        </Button>
      </div>
    );
  }

  // 5. Eligible to Claim slot (2-Step dynamic gating)
  return (
    <div className="premium-panel rounded-2xl p-6">
      {renderHeader("Claim Developer Slot", <Users className="h-4.5 w-4.5 text-primary" />)}
      <p className="text-xs text-muted-foreground leading-relaxed mb-5">
        You are verified and eligible to compete. Claiming a slot requires locked collateral of **{formatUnits(stakeRequiredBigInt, bounty.tokenSymbol === "USDC" ? 6 : 18)} {bounty.tokenSymbol}** which will be refunded in full upon successful CI attestation.
      </p>

      {needsApproval ? (
        <Button
          onClick={handleApprove}
          disabled={isActionPending}
          className="w-full font-semibold shadow-glow btn-shine gap-2"
        >
          {isActionPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Approving Escrow Allowance...
            </>
          ) : (
            <>
              <Coins className="h-4 w-4" />
              Step 1: Approve Token Spend
            </>
          )}
        </Button>
      ) : (
        <Button
          onClick={handleClaimSlot}
          disabled={isActionPending}
          className="w-full font-semibold shadow-glow btn-shine gap-2"
        >
          {isActionPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining Marketplace Escrow...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {stakeRequiredBigInt > 0n ? "Step 2: Lock Collateral & Claim Slot" : "Claim Free Developer Slot"}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
