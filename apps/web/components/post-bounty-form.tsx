"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CircleDollarSign,
  Code2,
  GitBranch,
  Loader2,
  Shield,
  Sliders,
  Users,
  Wallet,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Info,
  Coins,
} from "lucide-react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOKEN_META, type TokenSymbol } from "@/lib/token-meta";
import { celoMainnet, celoSepolia } from "@/lib/chain";
import { MAINNET, SEPOLIA, CLAUDELANCE_CORE_ABI } from "@yeheskieltame/claudelance-types";

// Standard ERC20 ABI for allowance and approve
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

type TokenId = "cusd" | "celo" | "usdc";
type BountyType = "open" | "direct";

type FormState = {
  token: TokenId;
  bountyType: BountyType;
  repoUrl: string;
  instructionUrl: string;
  amount: string;
  maxSlots: number;
  stakeRequired: string;
  deadlineDays: number;
  ciRequired: boolean;
  targetWorker: string;
};

const initialState: FormState = {
  token: "cusd",
  bountyType: "open",
  repoUrl: "",
  instructionUrl: "",
  amount: "",
  maxSlots: 3,
  stakeRequired: "0.1",
  deadlineDays: 7,
  ciRequired: true,
  targetWorker: "",
};

// ─── Zod Schemas ───
const step1Schema = z.object({
  amount: z.string()
    .min(1, "Bounty amount is required")
    .refine((val) => {
      const parsed = parseFloat(val);
      return !isNaN(parsed) && parsed > 0;
    }, "Amount must be a positive number"),
});

const step2Schema = z.object({
  repoUrl: z.string()
    .min(1, "Repository URL is required")
    .refine((val) => {
      try {
        const u = new URL(val);
        const parts = u.pathname.split("/").filter(Boolean);
        return u.hostname === "github.com" && parts.length >= 2;
      } catch {
        return false;
      }
    }, "Must be a valid GitHub Repository URL (e.g., https://github.com/owner/repo)"),
  instructionUrl: z.string()
    .min(1, "Instruction URL (issue link) is required")
    .refine((val) => {
      try {
        const u = new URL(val);
        const parts = u.pathname.split("/").filter(Boolean);
        return u.hostname === "github.com" && parts.includes("issues") && parts.length >= 4;
      } catch {
        return false;
      }
    }, "Must be a valid GitHub Issue URL (e.g., https://github.com/owner/repo/issues/123)"),
});

const step3Schema = z.object({
  stakeRequired: z.string()
    .min(1, "Worker stake is required")
    .refine((val) => {
      const parsed = parseFloat(val);
      return !isNaN(parsed) && parsed >= 0;
    }, "Stake must be 0 or more"),
  maxSlots: z.number().int().min(1, "Must allow at least 1 slot").max(10, "Maximum slots allowed is 10"),
  deadlineDays: z.number().int().min(1, "Deadline must be at least 1 day").max(90, "Deadline cannot exceed 90 days"),
  ciRequired: z.boolean(),
  targetWorker: z.string().optional(),
});

export function PostBountyForm() {
  const [mounted, setMounted] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState<FormState>(initialState);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  
  // Transaction states
  const [isApproving, setIsApproving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [successHash, setSuccessHash] = React.useState<string | null>(null);

  const { address, isConnected, chain } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // ─── Dynamic Network Address Resolution ───
  const activeChainId = chain?.id;
  const isSepolia = activeChainId === celoSepolia.id;
  const deployment = isSepolia ? SEPOLIA : MAINNET;
  const targetChain = isSepolia ? celoSepolia : celoMainnet;

  const tokenAddresses = React.useMemo(() => {
    return {
      cusd: deployment.tokens.cUSD,
      celo: deployment.tokens.CELO,
      usdc: deployment.tokens.USDC,
    };
  }, [deployment]);

  const selectedTokenAddress = tokenAddresses[form.token] as Address;
  const coreAddress = deployment.core as Address;

  // ─── Wagmi Reads ───
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedTokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && coreAddress ? [address, coreAddress] : undefined,
    query: {
      enabled: !!address && !!coreAddress && !!selectedTokenAddress && mounted,
    }
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const selectedSymbol: TokenSymbol = React.useMemo(() => {
    if (form.token === "celo") return "CELO";
    if (form.token === "usdc") return "USDC";
    return "cUSD";
  }, [form.token]);

  const selectedMeta = TOKEN_META[selectedSymbol];

  const selectedDecimals = React.useMemo(() => {
    return selectedSymbol === "USDC" ? 6 : 18;
  }, [selectedSymbol]);

  const minAmount = React.useMemo(() => {
    return form.token === "celo" ? 1.0 : 0.5;
  }, [form.token]);

  const connectors = useConnectors();
  const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];

  // ─── Wizard Validation & Navigation ───
  const validateStep = (currentStep: number): boolean => {
    setErrors({});
    if (currentStep === 1) {
      const res = step1Schema.safeParse({ amount: form.amount });
      if (!res.success) {
        const fieldErrors: Record<string, string> = {};
        res.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
      // Dynamic minimum validation
      const val = parseFloat(form.amount);
      if (val < minAmount) {
        setErrors({ amount: `Minimum amount for ${selectedSymbol} is ${minAmount}` });
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      const res = step2Schema.safeParse({
        repoUrl: form.repoUrl,
        instructionUrl: form.instructionUrl,
      });
      if (!res.success) {
        const fieldErrors: Record<string, string> = {};
        res.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
      // Repo URL must be a base prefix of the issue URL
      if (!form.instructionUrl.toLowerCase().startsWith(form.repoUrl.toLowerCase())) {
        setErrors({
          instructionUrl: "Issue URL must belong to the specified target repository",
        });
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      const res = step3Schema.safeParse({
        stakeRequired: form.stakeRequired,
        maxSlots: form.maxSlots,
        deadlineDays: form.deadlineDays,
        ciRequired: form.ciRequired,
      });
      if (!res.success) {
        const fieldErrors: Record<string, string> = {};
        res.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
      if (form.bountyType === "direct") {
        const isAddress = /^0x[a-fA-F0-9]{40}$/.test(form.targetWorker);
        if (!isAddress) {
          setErrors({ targetWorker: "Must be a valid worker Ethereum wallet address (0x...)" });
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => prev - 1);
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const handleConnect = () => {
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  // ─── Allowance & On-chain posting actions ───
  const parsedAmount = React.useMemo(() => {
    try {
      return form.amount ? parseUnits(form.amount, selectedDecimals) : 0n;
    } catch {
      return 0n;
    }
  }, [form.amount, selectedDecimals]);

  const parsedStake = React.useMemo(() => {
    try {
      return form.stakeRequired ? parseUnits(form.stakeRequired, selectedDecimals) : 0n;
    } catch {
      return 0n;
    }
  }, [form.stakeRequired, selectedDecimals]);

  const hasAllowance = React.useMemo(() => {
    if (!allowance) return false;
    return allowance >= parsedAmount;
  }, [allowance, parsedAmount]);

  const handleApprove = async () => {
    if (!address || !coreAddress || !selectedTokenAddress) return;
    setIsApproving(true);
    const id = toast.loading(`Approving ${selectedSymbol} spending...`);
    try {
      const hash = await writeContractAsync({
        address: selectedTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [coreAddress, parsedAmount],
      });
      toast.loading("Awaiting block confirmation...", { id });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast.success(`${selectedSymbol} approved successfully!`, { id });
      await refetchAllowance();
    } catch (err: any) {
      toast.error(err.message || "Approval transaction failed", { id });
    } finally {
      setIsApproving(false);
    }
  };

  const handlePublish = async () => {
    if (!address || !coreAddress) return;
    setIsPublishing(true);
    const id = toast.loading("Publishing bounty to Celo network...");
    try {
      const deadlineSeconds = BigInt(
        Math.floor(Date.now() / 1000) + form.deadlineDays * 24 * 60 * 60
      );

      let hash: `0x${string}`;
      if (form.bountyType === "direct") {
        hash = await writeContractAsync({
          address: coreAddress,
          abi: CLAUDELANCE_CORE_ABI,
          functionName: "postDirectHire",
          args: [
            selectedTokenAddress,
            form.targetWorker as Address,
            0, // Code bounty type
            form.repoUrl,
            form.instructionUrl,
            `0x${"0".repeat(64)}`, // Ad-hoc hash
            parsedAmount,
            parsedStake,
            deadlineSeconds,
          ],
        });
      } else {
        hash = await writeContractAsync({
          address: coreAddress,
          abi: CLAUDELANCE_CORE_ABI,
          functionName: "postBounty",
          args: [
            selectedTokenAddress,
            0, // Code bounty type
            form.repoUrl,
            form.instructionUrl,
            `0x${"0".repeat(64)}`, // Ad-hoc hash
            parsedAmount,
            form.maxSlots,
            parsedStake,
            deadlineSeconds,
            form.ciRequired,
          ],
        });
      }

      toast.loading("Securing escrow in blockchain block...", { id });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast.success("Bounty posted successfully!", { id });
      setSuccessHash(hash);
      setStep(5); // Show final victory step
    } catch (err: any) {
      toast.error(err.message || "Bounty post failed", { id });
    } finally {
      setIsPublishing(false);
    }
  };

  if (!mounted) {
    return (
      <div className="premium-panel flex min-h-[350px] items-center justify-center rounded-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── SUCCESS VICTORY VIEW ───
  if (step === 5) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="premium-panel relative overflow-hidden rounded-2xl p-8 sm:p-10">
          {/* Top light glow wash */}
          <div className="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-success/20 blur-3xl" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>

            <h2 className="mt-6 text-2xl font-bold tracking-tight">Escrow Locked & Posted!</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your bounty is now on-chain. Competitors can claim slots and submit pull requests immediately.
            </p>

            <div className="mt-8 w-full space-y-3 rounded-xl bg-card/40 p-5 text-left border border-border">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Bounty Amount:</span>
                <span className="font-semibold text-foreground">
                  {form.amount} {selectedSymbol}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Required Stake:</span>
                <span className="font-semibold text-foreground">
                  {form.stakeRequired} {selectedSymbol}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Verification:</span>
                <span className="font-semibold text-foreground">
                  {form.ciRequired ? "CI Required to pass" : "Ad-hoc Pick"}
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-border/60 pt-2.5">
                <span className="text-muted-foreground">Chain Network:</span>
                <span className="font-semibold text-primary">
                  {targetChain.name}
                </span>
              </div>
            </div>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                className="w-full gap-2 text-xs"
                onClick={() => { window.location.href = "/bounties"; }}
              >
                Go to feed
              </Button>
              {successHash && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-xs"
                  onClick={() => {
                    const explorer = targetChain.blockExplorers?.default.url;
                    if (explorer) window.open(`${explorer}/tx/${successHash}`, "_blank");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View block transaction
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEPPER HEADER ───
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      {/* 4-Step Stepper Component */}
      <div className="relative">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-border/40 z-0">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out-quad"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />
        </div>

        <div className="relative z-10 flex justify-between">
          {[
            { num: 1, label: "Payment", desc: "Escrow" },
            { num: 2, label: "Scope", desc: "GitHub" },
            { num: 3, label: "Rules", desc: "Settings" },
            { num: 4, label: "Publish", desc: "Review" },
          ].map((s) => {
            const isCompleted = step > s.num;
            const isActive = step === s.num;
            return (
              <div key={s.num} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    // Allow clicking back to completed steps
                    if (s.num < step) {
                      setStep(s.num);
                      setErrors({});
                    }
                  }}
                  disabled={s.num >= step}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-180",
                    isCompleted
                      ? "border-success bg-success/15 text-success"
                      : isActive
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-glow"
                      : "border-border bg-card text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-4.5 w-4.5" /> : s.num}
                </button>
                <span
                  className={cn(
                    "mt-2 text-[11px] font-medium tracking-wide uppercase",
                    isActive ? "text-primary" : "text-muted-foreground/80"
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── STEP 1: PAYMENT & AMOUNT ─── */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in duration-180">
          <FormSection icon={<CircleDollarSign className="h-5 w-5" />} title="Payment Token & Escrow Amount">
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Select which whitelisted ERC-20 token will fund this escrow bounty. The amount will be locked in the smart contract upon submission.
            </p>

            <div className="flex gap-3">
              {(["cusd", "celo", "usdc"] as TokenId[]).map((tokenId) => {
                const sym: TokenSymbol = tokenId === "celo" ? "CELO" : tokenId === "usdc" ? "USDC" : "cUSD";
                const meta = TOKEN_META[sym];
                const active = form.token === tokenId;
                return (
                  <button
                    key={tokenId}
                    type="button"
                    onClick={() => update("token", tokenId)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all duration-180",
                      active
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                        : "border-border bg-card/45 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    <img
                      src={meta.logoUrl}
                      alt={sym}
                      width={18}
                      height={18}
                      className="rounded-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    {sym}
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Bounty Escrow Amount</label>
              <div className="relative mt-2">
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  autoComplete="off"
                  step="any"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => update("amount", e.target.value)}
                  className={cn(
                    "w-full rounded-xl border bg-card/40 px-4 py-3.5 pr-16 text-sm outline-none transition-all placeholder:text-muted-foreground/35 focus:ring-2 focus:ring-primary/20",
                    errors.amount ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  {selectedSymbol}
                </span>
              </div>
              {errors.amount && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {errors.amount}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground border border-primary/10">
              <Info className="h-4 w-4 shrink-0 text-primary" />
              <span>
                Minimum required fund for {selectedSymbol} is <strong className="font-semibold text-foreground">{minAmount} {selectedSymbol}</strong>.
              </span>
            </div>
          </FormSection>

          <Button size="lg" className="w-full gap-2 btn-shine" onClick={handleNext}>
            Next: Scope & repository <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ─── STEP 2: REPOSITORY & SCOPE ─── */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in duration-180">
          <FormSection icon={<GitBranch className="h-5 w-5" />} title="Target Github Scope">
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">
              Specify the repository and issue where competitors will perform the work. The commit history and issues must be public.
            </p>

            <div>
              <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Target Repository URL</label>
              <input
                type="url"
                placeholder="https://github.com/owner/repo"
                value={form.repoUrl}
                onChange={(e) => update("repoUrl", e.target.value)}
                className={cn(
                  "mt-2 w-full rounded-xl border bg-card/40 px-4 py-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/35 focus:ring-2 focus:ring-primary/20",
                  errors.repoUrl ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                )}
              />
              {errors.repoUrl && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {errors.repoUrl}
                </div>
              )}
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Instruction URL (GitHub Issue)</label>
              <input
                type="url"
                placeholder="https://github.com/owner/repo/issues/123"
                value={form.instructionUrl}
                onChange={(e) => update("instructionUrl", e.target.value)}
                className={cn(
                  "mt-2 w-full rounded-xl border bg-card/40 px-4 py-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/35 focus:ring-2 focus:ring-primary/20",
                  errors.instructionUrl ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                )}
              />
              {errors.instructionUrl && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {errors.instructionUrl}
                </div>
              )}
            </div>
          </FormSection>

          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1 gap-2" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="lg" className="flex-1 gap-2 btn-shine" onClick={handleNext}>
              Next: Configuration <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: WIZARD CONFIGURATIONS ─── */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in duration-180">
          <FormSection icon={<Sliders className="h-5 w-5" />} title="Escrow Settings & Stake">
            
            {/* Open / Direct Hire type Selector */}
            <div className="mb-6">
              <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Bounty Type</label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <TypeCard
                  active={form.bountyType === "open"}
                  onClick={() => update("bountyType", "open")}
                  title="Open Marketplace"
                  description="Competitors register and claim slots to solve the issue."
                />
                <TypeCard
                  active={form.bountyType === "direct"}
                  onClick={() => update("bountyType", "direct")}
                  title="Direct Hire"
                  description="Assign explicitly to a single worker address."
                />
              </div>
            </div>

            {/* Direct Hire Target address */}
            {form.bountyType === "direct" ? (
              <div className="mb-6">
                <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Target Worker Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={form.targetWorker}
                  onChange={(e) => update("targetWorker", e.target.value)}
                  className={cn(
                    "mt-2 w-full rounded-xl border bg-card/40 px-4 py-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/35 focus:ring-2 focus:ring-primary/20",
                    errors.targetWorker ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                  )}
                />
                {errors.targetWorker && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {errors.targetWorker}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6">
                <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Max Worker Slots</label>
                <div className="mt-2 flex items-center gap-4 bg-card/35 rounded-xl border border-border p-3.5">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={form.maxSlots}
                    onChange={(e) => update("maxSlots", Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
                  />
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {form.maxSlots}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase h-4">
                  <Coins className="h-3.5 w-3.5" /> Required Stake
                </label>
                <div className="relative mt-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    autoComplete="off"
                    step="any"
                    placeholder="0.10"
                    value={form.stakeRequired}
                    onChange={(e) => update("stakeRequired", e.target.value)}
                    className={cn(
                      "w-full rounded-xl border bg-card/40 px-4 py-3.5 pr-16 text-sm outline-none transition-all placeholder:text-muted-foreground/35 focus:ring-2 focus:ring-primary/20",
                      errors.stakeRequired ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                    )}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    {selectedSymbol}
                  </span>
                </div>
                {errors.stakeRequired && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {errors.stakeRequired}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase h-4">
                  <Calendar className="h-3.5 w-3.5" /> Lifetime (days)
                </label>
                <div className="mt-2">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={form.deadlineDays}
                    onChange={(e) => update("deadlineDays", Math.min(90, Math.max(1, Number(e.target.value))))}
                    className={cn(
                      "w-full rounded-xl border bg-card/40 px-4 py-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/35 focus:ring-2 focus:ring-primary/20",
                      errors.deadlineDays ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                    )}
                  />
                </div>
                {errors.deadlineDays && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {errors.deadlineDays}
                  </div>
                )}
              </div>
            </div>

            {form.bountyType !== "direct" && (
              <div className="mt-6 border-t border-border/60 pt-5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.ciRequired}
                  onClick={() => update("ciRequired", !form.ciRequired)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card/40 px-4 py-4 text-left text-sm outline-none transition-all hover:border-primary/30"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground">Require CI Attestation</span>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      The automated relayer will check and sign tests/CI status before you can pick a winner.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "relative h-6.5 w-11 shrink-0 rounded-full transition-colors",
                      form.ciRequired ? "bg-primary" : "bg-border"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow-sm transition-transform duration-200",
                        form.ciRequired ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </div>
                </button>
              </div>
            )}
          </FormSection>

          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1 gap-2" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="lg" className="flex-1 gap-2 btn-shine" onClick={handleNext}>
              Next: Review & Post <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: REVIEW & ESCROW PUBLISHING ─── */}
      {step === 4 && (
        <div className="space-y-6 animate-fade-in duration-180">
          <FormSection icon={<Shield className="h-5 w-5" />} title="Confirm & Payout Lock">
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">
              Review your bounty settings below. Posting will perform a blockchain transaction that creates the on-chain escrow structure.
            </p>

            <div className="grid grid-cols-2 gap-4 rounded-xl bg-card/35 border border-border p-5 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Payment Escrow</span>
                <p className="mt-1 font-bold text-foreground">
                  {form.amount} {selectedSymbol}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Required Worker Stake</span>
                <p className="mt-1 font-bold text-foreground">
                  {form.stakeRequired} {selectedSymbol}
                </p>
              </div>
              <div className="col-span-2 border-t border-border/40 my-1.5" />
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">GitHub Scope Link</span>
                <p className="mt-1 font-medium text-foreground truncate max-w-full">
                  {form.instructionUrl}
                </p>
              </div>
              <div className="col-span-2 border-t border-border/40 my-1.5" />
              <div>
                <span className="text-xs text-muted-foreground">Bounty Type</span>
                <p className="mt-1 font-semibold text-primary uppercase text-xs">
                  {form.bountyType === "direct" ? `Direct Hire (${form.targetWorker.slice(0, 6)}...)` : "Open Marketplace"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Lifetime / Deadline</span>
                <p className="mt-1 font-semibold text-foreground">
                  {form.deadlineDays} Days
                </p>
              </div>
            </div>

            {/* Allowance information block */}
            <div className="mt-6 rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground space-y-2">
              <div className="flex justify-between">
                <span>Core Escrow Agent:</span>
                <code className="text-foreground">{coreAddress.slice(0, 8)}...{coreAddress.slice(-6)}</code>
              </div>
              <div className="flex justify-between">
                <span>Your Token Balance:</span>
                <span className="font-semibold text-foreground">{selectedSymbol} Escrow Ready</span>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-2">
                <span>Contract Spend Allowance:</span>
                <span className={cn("font-bold", isConnected && hasAllowance ? "text-success" : "text-warn")}>
                  {!isConnected
                    ? "Wallet not connected"
                    : allowance
                    ? `${formatUnits(allowance, selectedDecimals)} ${selectedSymbol}`
                    : "Checking..."}
                </span>
              </div>
            </div>
          </FormSection>

          {/* Connected wallet validation actions */}
          <div className="space-y-3 pt-2">
            {!isConnected ? (
              <>
                <Button size="lg" className="w-full gap-2" onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {isConnecting ? "Connecting wallet..." : "Connect wallet to post"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Connect MetaMask or MiniPay to submit this bounty.
                </p>
              </>
            ) : chain?.id !== targetChain.id ? (
              <>
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => switchChain({ chainId: targetChain.id })}
                  disabled={isSwitching}
                >
                  {isSwitching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {isSwitching ? "Switching network..." : `Switch to ${targetChain.name}`}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Wrong network. Switch to {targetChain.name} to deploy the escrow.
                </p>
              </>
            ) : !hasAllowance ? (
              <>
                <Button
                  size="lg"
                  className="w-full gap-2 btn-shine"
                  onClick={handleApprove}
                  disabled={isApproving}
                >
                  {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  {isApproving ? "Approving spending..." : `Approve ${selectedSymbol} Spending`}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Allow the smart contract to move {form.amount} {selectedSymbol} to fund the escrow bounty.
                </p>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="w-full gap-2 btn-shine"
                  onClick={handlePublish}
                  disabled={isPublishing}
                >
                  {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
                  {isPublishing ? "Publishing bounty..." : "Post bounty & lock escrow"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Escrow fund has been fully approved. Ready to deploy!
                </p>
              </>
            )}
          </div>

          <div className="pt-4 flex justify-center border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-muted-foreground hover:text-foreground transition-all duration-180"
              onClick={handleBack}
              disabled={isApproving || isPublishing}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Rules
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="premium-panel rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function TypeCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-180",
        active
          ? "border-primary bg-primary/[0.08] shadow-sm ring-1 ring-primary"
          : "border-border bg-card/40 hover:border-primary/40 hover:text-foreground"
      )}
    >
      <span className={cn("text-xs font-semibold uppercase tracking-wider", active ? "text-primary" : "text-foreground")}>
        {title}
      </span>
      <span className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}
