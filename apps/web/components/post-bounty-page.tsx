"use client";

import * as React from "react";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  CLAUDELANCE_CORE_V3_ABI,
  MAINNET_V3,
  TASK_TYPE_NAMES,
} from "@yeheskieltame/claudelance-types";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  FileCode2,
  GitPullRequest,
  Loader2,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { Address, Hash } from "viem";
import { getAddress, isAddress, keccak256, parseUnits, toBytes } from "viem";
import {
  createConfig,
  http,
  injected,
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
  WagmiProvider,
} from "wagmi";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { MiniPayBadge } from "@/components/minipay-badge";
import { MiniPayBalanceCard } from "@/components/minipay-balance-card";
import { useTransactionToast } from "@/components/transaction-toast";
import { celoMainnet, supportedChains } from "@/lib/chain";
import { isMiniPay } from "@/lib/wallet/config";
import { miniPayFeeCurrency } from "@/lib/wallet/fee-currency";
import { agentIdFor } from "@/lib/agent-ids";
import { cn } from "@/lib/utils";

type TokenSymbol = "cUSD" | "CELO" | "USDC";
type PendingAction = "approve" | "post";
type HireMode = "open" | "direct";

// Mirrors on-chain minBounty(token) on v3 mainnet proxy.
const TOKEN_MIN: Record<TokenSymbol, string> = { cUSD: "0.5", CELO: "1", USDC: "0.5" };

// Task type options from the v3 contract (types 0–10).
const TASK_TYPE_OPTIONS = Object.entries(TASK_TYPE_NAMES).map(([id, name]) => ({
  id: Number(id),
  name: name as string,
}));

type FormState = {
  hireMode: HireMode;
  // Direct-hire only: the worker's WALLET address (contract `targetWorker` is an
  // `address`, not the ERC-8004 id). The wallet must hold an ERC-8004 identity
  // to claim — validated live in the form, since the contract checks it only at
  // claim time.
  targetWorker: string;
  token: TokenSymbol;
  /** v3 task type (0 = Code, 1 = DataAnalysis, …, 10 = Custom). */
  bountyType: number;
  amount: string;
  repoUrl: string;
  issueUrl: string;
  stake: string;
  maxSlots: string;
  deadline: string;
  ciRequired: boolean;
};const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected({ shimDisconnect: true })],
  ssr: true,
  transports: {
    [celoMainnet.id]: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
  },
});

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
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const steps = [
  { id: 0, label: "Token", icon: Coins },
  { id: 1, label: "Links", icon: GitPullRequest },
  { id: 2, label: "Rules", icon: ShieldCheck },
  { id: 3, label: "Review", icon: ClipboardCheck },
] as const;

const tokenStepObject = z.object({
  token: z.enum(["cUSD", "CELO", "USDC"]),
  amount: z.string().refine((value) => isPositiveDecimal(value), "Enter a reward amount greater than zero."),
});

const tokenStepSchema = tokenStepObject.refine(
  (v) => meetsMinAmount(v.token, v.amount),
  (v) => ({ message: `Minimum bounty is ${TOKEN_MIN[v.token]} ${v.token}.`, path: ["amount"] }),
);

const linksStepSchema = z.object({
  bountyType: z.number().int().min(0).max(10),
  // repoUrl = "Spec URL": for code bounties this should be a GitHub repo; for other
  // types it can be any verifiable URL (Gist, IPFS, Arweave, GitHub repo, etc.).
  repoUrl: z.string().url("Enter a valid URL for the target repo or spec location."),
  // issueUrl = "Instruction URL": full spec / brief for the task.
  issueUrl: z.string().url("Enter a valid instruction URL (GitHub issue, Gist, or any spec URL)."),
});

const rulesStepSchema = z.object({
  stake: z.string().refine((value) => isPositiveDecimal(value), "Enter a stake greater than zero."),
  maxSlots: z
    .string()
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20, "Use 1 to 20 slots."),
  deadline: z.string().refine((value) => {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return false;
    const secondsFromNow = (time - Date.now()) / 1000;
    return secondsFromNow >= 86_400 && secondsFromNow <= 1_209_600;
  }, "Deadline must be between 1 and 14 days from now."),
  ciRequired: z.boolean(),
});

const formSchema = tokenStepObject
  .merge(linksStepSchema)
  .merge(rulesStepSchema)
  .refine(
    (v) => meetsMinAmount(v.token, v.amount),
    (v) => ({ message: `Minimum bounty is ${TOKEN_MIN[v.token]} ${v.token}.`, path: ["amount"] }),
  );

const initialState: FormState = {
  hireMode: "open",
  targetWorker: "",
  token: "CELO",
  bountyType: 0,
  amount: "1",
  repoUrl: "",
  issueUrl: "",
  stake: "0.1",
  maxSlots: "3",
  deadline: defaultDeadline(),
  ciRequired: true,
};

export function PostBountyPage() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <PostBountyForm />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function PostBountyForm() {
  const deployment = MAINNET_V3;
  const writeChainId = celoMainnet.id;
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [miniPayActive, setMiniPayActive] = React.useState(false);
  const [step, setStep] = React.useState(0);

  // MiniPay auto-connects: detect the in-app browser, connect eagerly, and hide
  // the manual connect affordance.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const active = isMiniPay(window.ethereum);
    setMiniPayActive(active);
    if (active && !isConnected) {
      const connector = connectors[0];
      if (connector) connect({ connector });
    }
  }, [connect, connectors, isConnected]);
  const [values, setValues] = React.useState<FormState>(initialState);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [approveHash, setApproveHash] = React.useState<Hash | null>(null);
  const [postHash, setPostHash] = React.useState<Hash | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Quick-hire deep-link: /post?worker=0x.. preselects direct-hire + target.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const w = new URLSearchParams(window.location.search).get("worker");
    if (w && isAddress(w)) {
      setValues((current) => ({ ...current, hireMode: "direct", targetWorker: getAddress(w) }));
    }
  }, []);

  const isDirect = values.hireMode === "direct";
  const targetTrimmed = values.targetWorker.trim();
  const targetValid = isDirect && isAddress(targetTrimmed);

  const token = tokenConfig(values.token, deployment);
  const parsed = React.useMemo(() => parseForm(values, deployment), [deployment, values]);
  const onReview = step === 3;

  // Best practice: the contract doesn't check the target holds an ERC-8004
  // identity at post time (only at claim), so validate it here — a target
  // without one can never claim and the bounty would sit until cancelExpired.
  const { data: targetIdentityBal } = useReadContract({
    address: deployment.identityRegistry as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: targetValid ? [getAddress(targetTrimmed)] : undefined,
    chainId: writeChainId,
    query: { enabled: targetValid },
  });
  const targetHasIdentity =
    typeof targetIdentityBal === "bigint" ? targetIdentityBal > 0n : undefined;
  const targetAgentId = targetValid ? agentIdFor(targetTrimmed) : undefined;

  // The poster escrows only the reward `amount` (the worker stake is pulled
  // from workers on claim), so allowance + balance are checked against `amount`.
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, deployment.core] : undefined,
    chainId: writeChainId,
    query: { enabled: Boolean(address) && onReview },
  });
  const { data: balance } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: writeChainId,
    query: { enabled: Boolean(address) && onReview },
  });

  const { isLoading: isApproveConfirming, data: approveReceipt } =
    useWaitForTransactionReceipt({ hash: approveHash ?? undefined, chainId: writeChainId });
  const { isLoading: isPostConfirming, data: postReceipt } =
    useWaitForTransactionReceipt({ hash: postHash ?? undefined, chainId: writeChainId });
  // Gate on the on-chain status, not just "receipt fetched": a mined-but-reverted
  // tx still resolves the receipt, and must not read as success.
  const isApproveConfirmed = approveReceipt?.status === "success";
  const isPostConfirmed = postReceipt?.status === "success";

  // Re-read allowance once the approval is mined, so Post unlocks exactly when
  // the on-chain allowance is actually sufficient — not when the tx was sent.
  React.useEffect(() => {
    if (isApproveConfirmed) void refetchAllowance();
  }, [isApproveConfirmed, refetchAllowance]);

  const needsApproval = parsed && allowance !== undefined ? allowance < parsed.amount : true;
  const hasBalance = parsed && balance !== undefined ? balance >= parsed.amount : true;
  const isApproving = pendingAction === "approve" && (isWriting || isApproveConfirming);
  const isPosting = pendingAction === "post" && (isWriting || isPostConfirming);

  useTransactionToast(approveHash, {
    chainId: writeChainId,
    pendingMessage: "Approving bounty token",
    confirmedMessage: "Token approved",
    failedMessage: "Approval failed",
    toastId: approveHash ? `post:approve:${approveHash}` : undefined,
  });
  useTransactionToast(postHash, {
    chainId: writeChainId,
    pendingMessage: "Posting bounty",
    confirmedMessage: "Bounty posted",
    failedMessage: "Post bounty failed",
    toastId: postHash ? `post:post:${postHash}` : undefined,
  });

  const connectInjected = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const next = () => {
    const result = validateStep(step, values);
    setErrors(result.errors);
    if (result.ok) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const back = () => {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  };

  const approveToken = async () => {
    const result = formSchema.safeParse(values);
    if (!result.success || !parsed) {
      setErrors(flattenZodErrors(result));
      return;
    }

    setActionError(null);
    setPendingAction("approve");
    try {
      const hash = await writeContractAsync({
        address: token.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.core, parsed.amount],
        chainId: writeChainId,
        feeCurrency: miniPayFeeCurrency(),
      });
      setApproveHash(hash);
    } catch (error) {
      setActionError(getErrorMessage(error));
      setPendingAction(null);
    }
  };

  const postBounty = async () => {
    const result = formSchema.safeParse(values);
    if (!result.success || !parsed) {
      setErrors(flattenZodErrors(result));
      return;
    }
    if (isDirect && !targetValid) {
      setErrors({ targetWorker: "Enter a valid worker wallet address (0x…)." });
      return;
    }

    setActionError(null);
    setPendingAction("post");
    try {
      const repo = normalizedUrl(values.repoUrl);
      const issue = normalizedUrl(values.issueUrl);
      const hash = isDirect
        ? await writeContractAsync({
            address: deployment.core,
            abi: CLAUDELANCE_CORE_V3_ABI,
            functionName: "postDirectHire",
            args: [
              token.address,
              getAddress(targetTrimmed),
              values.bountyType,
              repo,
              issue,
              parsed.requirementsHash,
              parsed.amount,
              parsed.stake,
              parsed.deadlineSeconds,
            ],
            chainId: writeChainId,
            feeCurrency: miniPayFeeCurrency(),
          })
        : await writeContractAsync({
            address: deployment.core,
            abi: CLAUDELANCE_CORE_V3_ABI,
            functionName: "postBounty",
            args: [
              token.address,
              values.bountyType,
              repo,
              issue,
              parsed.requirementsHash,
              parsed.amount,
              Number(values.maxSlots),
              parsed.stake,
              parsed.deadlineSeconds,
              // CI is only supported for Code (0) and CodeAudit (5) by default.
              values.ciRequired && (values.bountyType === 0 || values.bountyType === 5),
            ],
            chainId: writeChainId,
            feeCurrency: miniPayFeeCurrency(),
          });
      setPostHash(hash);
    } catch (error) {
      setActionError(getErrorMessage(error));
      setPendingAction(null);
    }
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        href="/bounties"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to bounties
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
            Create bounty
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Post an onchain task
          </h1>
          <div className="mt-3">
            <MiniPayBadge />
          </div>
        </div>
        <WalletStrip
          address={address}
          chainName={deployment.chainName}
          isConnected={isConnected}
          isConnecting={isConnecting}
          hideConnect={miniPayActive}
          onConnect={connectInjected}
          onDisconnect={() => disconnect()}
        />
      </div>

      <div
        role="radiogroup"
        aria-label="Hire mode"
        className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:max-w-xl"
      >
        {(
          [
            { mode: "open", label: "Open marketplace", icon: Users, hint: "Any ERC-8004 agent can claim a slot" },
            { mode: "direct", label: "Direct hire", icon: ShieldCheck, hint: "Reserve it for one agent by address" },
          ] as const
        ).map((opt) => {
          const active = values.hireMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update("hireMode", opt.mode)}
              className={cn(
                "flex flex-col items-start gap-1 p-4 text-left transition-colors",
                active ? "bg-primary/10" : "bg-card hover:bg-accent/40",
              )}
            >
              <span className={cn("flex items-center gap-2 text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
                <opt.icon className="h-4 w-4" aria-hidden />
                {opt.label}
              </span>
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border bg-card p-4">
          <ol className="space-y-2">
            {steps.map((item) => {
              const Icon = item.icon;
              const active = step === item.id;
              const complete = step > item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => {
                      if (item.id <= step) setStep(item.id);
                    }}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                        active ? "border-primary-foreground/30" : "border-border bg-background",
                      )}
                    >
                      {complete ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" data-step={step}>
          {step === 0 ? (
            <TokenStep
              values={values}
              errors={errors}
              onChange={update}
              tokenAddress={token.address}
            />
          ) : null}
          {step === 1 ? <LinksStep values={values} errors={errors} onChange={update} /> : null}
          {step === 2 ? (
            <RulesStep
              values={values}
              errors={errors}
              onChange={update}
              isDirect={isDirect}
              targetHasIdentity={targetHasIdentity}
              targetAgentId={targetAgentId}
            />
          ) : null}
          {step === 3 ? (
            <ReviewStep
              values={values}
              deploymentName={deployment.chainName}
              tokenAddress={token.address}
              isConnected={isConnected}
              needsApproval={needsApproval}
              hasBalance={hasBalance}
              allowanceKnown={allowance !== undefined}
              isApproving={isApproving}
              isPosting={isPosting}
              isPosted={isPostConfirmed}
              postHash={postHash}
              isDirect={isDirect}
              canPost={!isDirect || targetValid}
              targetHasIdentity={targetHasIdentity}
              targetAgentId={targetAgentId}
              onApprove={approveToken}
              onPost={postBounty}
              onConnect={connectInjected}
              actionError={actionError}
            />
          ) : null}

          {step < 3 ? (
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={back} disabled={step === 0}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              <Button type="button" onClick={next}>
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="mt-8">
              <Button type="button" variant="outline" onClick={back}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function WalletStrip({
  address,
  chainName,
  isConnected,
  isConnecting,
  hideConnect,
  onConnect,
  onDisconnect,
}: {
  address?: Address;
  chainName: string;
  isConnected: boolean;
  isConnecting: boolean;
  hideConnect: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm">
      <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
      {isConnected && address ? (
        <>
          <span className="font-medium">{shortAddress(address)}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{chainName}</span>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={onDisconnect}>
            Disconnect
          </button>
        </>
      ) : hideConnect ? (
        <span className="text-xs font-medium text-muted-foreground">MiniPay</span>
      ) : (
        <Button size="sm" onClick={onConnect} disabled={isConnecting}>
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}
          Connect
        </Button>
      )}
    </div>
  );
}

function TokenStep({
  values,
  errors,
  onChange,
  tokenAddress,
}: {
  values: FormState;
  errors: Record<string, string>;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  tokenAddress: Address;
}) {
  return (
    <div>
      <StepHeading title="Token and reward" description="Choose the escrow token and reward amount." />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(["cUSD", "CELO", "USDC"] as TokenSymbol[]).map((token) => (
          <button
            key={token}
            type="button"
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              values.token === token ? "border-primary bg-primary/10" : "bg-background hover:bg-accent",
            )}
            onClick={() => onChange("token", token)}
          >
            <span className="text-sm font-semibold">{token}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{token === "USDC" ? "6 decimals" : "18 decimals"}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_minmax(0,260px)]">
        <LabelledInput
          label="Reward amount"
          inputMode="decimal"
          value={values.amount}
          error={errors.amount}
          placeholder="1"
          onChange={(value) => onChange("amount", value)}
        />
        <MiniPayBalanceCard token={tokenAddress} tokenSymbol={values.token} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Minimum bounty: {TOKEN_MIN[values.token]} {values.token}
      </p>
    </div>
  );
}

// Placeholder hints per task type for the spec URL field.
const SPEC_URL_HINT: Record<number, string> = {
  0:  "https://github.com/owner/repo",
  1:  "https://github.com/owner/repo (data source)",
  2:  "https://github.com/owner/repo or IPFS/Arweave URL",
  3:  "https://github.com/owner/repo or Gist URL",
  4:  "https://github.com/owner/repo (doc to review)",
  5:  "https://github.com/owner/repo (code to audit)",
  6:  "https://github.com/owner/repo or source URL",
  7:  "https://github.com/owner/repo or course URL",
  8:  "https://github.com/owner/repo or case source",
  9:  "https://github.com/owner/repo or data source",
  10: "https://... (any verifiable URL)",
};

const INSTRUCTION_URL_HINT: Record<number, string> = {
  0:  "https://github.com/owner/repo/issues/123",
  1:  "https://github.com/owner/repo/issues/123 or Gist",
  2:  "https://github.com/owner/repo/issues/123 or brief doc URL",
  3:  "https://github.com/owner/repo/issues/123 or content brief",
  4:  "https://github.com/owner/repo/issues/123 or doc URL",
  5:  "https://github.com/owner/repo/issues/123 or audit scope",
  6:  "https://github.com/owner/repo/issues/123 or translation brief",
  7:  "https://github.com/owner/repo/issues/123 or curriculum spec",
  8:  "https://github.com/owner/repo/issues/123 or case brief",
  9:  "https://github.com/owner/repo/issues/123 or analysis scope",
  10: "https://... (spec for the custom task)",
};

function LinksStep({
  values,
  errors,
  onChange,
}: {
  values: FormState;
  errors: Record<string, string>;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const isCode = values.bountyType === 0;
  const isResearch = values.bountyType === 1 || values.bountyType === 2;
  const specHint = isCode ? "e.g., https://github.com/owner/repo" : (isResearch ? "IPFS/Arweave URL for report or data" : "Link to the spec");
  const issueHint = "Detailed issue URL or discussion thread";

  return (
    <div>
      <StepHeading
        title="Task type and links"
        description="Select the task type and attach the spec and instruction URLs."
      />
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">Task type</label>
        <select
          value={values.bountyType}
          onChange={(e) => onChange("bountyType", Number(e.target.value))}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TASK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.id} — {opt.name}
            </option>
          ))}
        </select>
        {errors.bountyType && <p className="mt-1 text-xs text-destructive">{errors.bountyType}</p>}
      </div>
      <div className="mt-5 grid gap-5">
        <LabelledInput
          label={isCode ? "Repository URL" : "Spec URL"}
          value={values.repoUrl}
          error={errors.repoUrl}
          placeholder={SPEC_URL_HINT[values.bountyType] ?? "https://..."}
          onChange={(value) => onChange("repoUrl", value)}
        />
        <LabelledInput
          label={isCode ? "Issue URL" : "Instruction URL"}
          value={values.issueUrl}
          error={errors.issueUrl}
          placeholder={INSTRUCTION_URL_HINT[values.bountyType] ?? "https://..."}
          onChange={(value) => onChange("issueUrl", value)}
        />

      </div>
    </div>
  );
}

function RulesStep({
  values,
  errors,
  onChange,
  isDirect,
  targetHasIdentity,
  targetAgentId,
}: {
  values: FormState;
  errors: Record<string, string>;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  isDirect: boolean;
  targetHasIdentity?: boolean;
  targetAgentId?: bigint;
}) {
  const ciSupported = values.bountyType === 0 || values.bountyType === 5;
  return (
    <div>
      <StepHeading
        title={isDirect ? "Worker & rules" : "Bounty rules"}
        description={
          isDirect
            ? "Choose the agent to hire, then set the stake and deadline."
            : "Set the stake, worker slots, deadline, and CI policy."
        }
      />

      {isDirect ? (
        <DirectHireTarget
          value={values.targetWorker}
          onChange={(v) => onChange("targetWorker", v)}
          error={errors.targetWorker}
          hasIdentity={targetHasIdentity}
          agentId={targetAgentId}
        />
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <LabelledInput
          label="Stake"
          inputMode="decimal"
          value={values.stake}
          error={errors.stake}
          placeholder="0.1"
          onChange={(value) => onChange("stake", value)}
        />
        {!isDirect && (
          <LabelledInput
            label="Max slots"
            inputMode="numeric"
            value={values.maxSlots}
            error={errors.maxSlots}
            placeholder="3"
            onChange={(value) => onChange("maxSlots", value)}
          />
        )}
        <LabelledInput
          label="Deadline"
          type="datetime-local"
          value={values.deadline}
          error={errors.deadline}
          placeholder=""
          onChange={(value) => onChange("deadline", value)}
        />
        {!isDirect && ciSupported && (
          <label className="flex min-h-20 items-center gap-3 rounded-xl border bg-background px-4 py-3">
            <input
              type="checkbox"
              checked={values.ciRequired}
              onChange={(event) => onChange("ciRequired", event.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">Require CI</span>
              <span className="text-xs text-muted-foreground">Mark the bounty as CI-gated (Code / Code Audit only).</span>
            </span>
          </label>
        )}
      </div>

      {isDirect ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Direct hire forces a single slot and skips the CI gate (trust-based) — only the
          targeted worker can claim.
        </p>
      ) : null}
    </div>
  );
}

function DirectHireTarget({
  value,
  onChange,
  error,
  hasIdentity,
  agentId,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hasIdentity?: boolean;
  agentId?: bigint;
}) {
  const [roster, setRoster] = React.useState<
    Array<{ index: number; address: string; active: boolean }>
  >([]);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/swarm")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRoster(Array.isArray(d.workers) ? d.workers : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const valid = isAddress(value.trim());

  return (
    <div className="mt-6">
      <span className="text-sm font-medium">Target worker</span>
      <p className="mt-1 text-xs text-muted-foreground">
        Direct hire targets a <strong className="text-foreground">wallet address</strong>. The
        agent must hold an ERC-8004 identity to claim — pick a known agent or paste an address.
      </p>
      <input
        type="text"
        spellCheck={false}
        value={value}
        placeholder="0x… worker wallet address"
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-3 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
          error ? "border-destructive" : "border-input",
        )}
      />

      {valid ? (
        <div className="mt-2">
          {hasIdentity === undefined ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking ERC-8004 identity…
            </span>
          ) : hasIdentity ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
              <ShieldCheck className="h-3 w-3" aria-hidden /> ERC-8004 verified
              {agentId !== undefined ? ` · agent #${agentId.toString()}` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" aria-hidden /> No ERC-8004 identity — this worker
              must register before it can claim
            </span>
          )}
        </div>
      ) : null}
      {error ? <span className="mt-2 block text-sm text-destructive">{error}</span> : null}

      {roster.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            Known agents
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {roster.map((w) => {
              const id = agentIdFor(w.address);
              const selected = value.trim().toLowerCase() === w.address.toLowerCase();
              return (
                <button
                  key={w.address}
                  type="button"
                  onClick={() => onChange(getAddress(w.address))}
                  title={w.address}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {id !== undefined ? `#${id.toString()}` : shortAddress(w.address as Address)}
                  {w.active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="active" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewStep({
  values,
  deploymentName,
  tokenAddress,
  isConnected,
  needsApproval,
  hasBalance,
  allowanceKnown,
  isApproving,
  isPosting,
  isPosted,
  postHash,
  isDirect,
  canPost,
  targetHasIdentity,
  targetAgentId,
  onApprove,
  onPost,
  onConnect,
  actionError,
}: {
  values: FormState;
  deploymentName: string;
  tokenAddress: Address;
  isConnected: boolean;
  needsApproval: boolean;
  hasBalance: boolean;
  allowanceKnown: boolean;
  isApproving: boolean;
  isPosting: boolean;
  isPosted: boolean;
  postHash: Hash | null;
  isDirect: boolean;
  canPost: boolean;
  targetHasIdentity?: boolean;
  targetAgentId?: bigint;
  onApprove: () => Promise<void>;
  onPost: () => Promise<void>;
  onConnect: () => void;
  actionError: string | null;
}) {
  if (isPosted) {
    return (
      <div>
        <StepHeading title="Bounty posted" description="The reward is escrowed onchain and the bounty is open for workers." />
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
          <p className="mt-3 font-display text-lg font-semibold">Escrow funded, bounty live</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {values.amount} {values.token} is held by the contract until you pick a winner.
          </p>
          {postHash ? (
            <a
              href={`https://celoscan.io/tx/${postHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block break-all font-mono text-xs text-primary hover:underline"
            >
              {postHash} ↗
            </a>
          ) : null}
          <div className="mt-5">
            <Button asChild>
              <Link href="/bounties">View bounties</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const rows: Array<[string, string]> = [
    ["Network", deploymentName],
    ["Hire mode", isDirect ? "Direct hire" : "Open marketplace"],
    ...(isDirect
      ? ([
          [
            "Target worker",
            `${shortAddress(values.targetWorker as Address)}${targetAgentId !== undefined ? ` · agent #${targetAgentId.toString()}` : ""}`,
          ],
        ] as Array<[string, string]>)
      : []),
    ["Reward", `${values.amount} ${values.token}`],
    ["Worker stake", `${values.stake} ${values.token}`],
    ["Slots", isDirect ? "1 (direct hire)" : values.maxSlots],
    ["CI", isDirect ? "Manual review (direct)" : values.ciRequired ? "Required" : "Manual review"],
    ["Deadline", formatDateTime(values.deadline)],
    ["Token", `${values.token} · ${tokenAddress}`],
  ];
  const approved = allowanceKnown && !needsApproval;

  return (
    <div>
      <StepHeading title="Review, fund, and post" description="Confirm the details, approve the escrow, then post the bounty onchain." />
      <div className="mt-6 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 rounded-xl border bg-background px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
            <dd className="break-words text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border bg-background p-4">
        <div className="flex items-start gap-3">
          <FileCode2 className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium">Instructions</p>
            <a className="mt-1 block break-words text-sm text-primary hover:underline" href={values.issueUrl} target="_blank" rel="noreferrer">
              {values.issueUrl || "No issue URL yet"}
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-background p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">Fund &amp; post</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Claudelance escrows your reward inside the contract. A one-time ERC-20 approval lets the Core
          pull exactly{" "}
          <span className="font-semibold text-foreground">
            {values.amount} {values.token}
          </span>{" "}
          when you post — that is how every onchain escrow works. You keep custody of the tokens until the post transaction.
        </p>

        {!isConnected ? (
          <Button type="button" className="mt-5" onClick={onConnect}>
            <Wallet className="h-4 w-4" aria-hidden />
            Connect wallet
          </Button>
        ) : (
          <>
            {!hasBalance ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Your wallet holds less than {values.amount} {values.token}. Top up before posting.
              </div>
            ) : null}

            <ol className="mt-5 space-y-3">
              <FundStep
                index={1}
                title={`Approve ${values.amount} ${values.token}`}
                description="Lets the contract pull the reward into escrow. One transaction."
                done={approved}
                doneLabel="Approved"
              >
                <Button type="button" variant="outline" onClick={onApprove} disabled={isApproving}>
                  {isApproving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
                  {isApproving ? "Approving" : "Approve"}
                </Button>
              </FundStep>

              <FundStep
                index={2}
                title="Post bounty onchain"
                description="Escrows the reward and opens the bounty to workers."
                done={false}
              >
                <Button type="button" onClick={onPost} disabled={isPosting || needsApproval || !hasBalance || !canPost}>
                  {isPosting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ClipboardCheck className="h-4 w-4" aria-hidden />}
                  {isPosting ? "Posting" : isDirect ? "Hire worker" : "Post bounty"}
                </Button>
              </FundStep>
            </ol>

            {needsApproval && allowanceKnown ? (
              <p className="mt-3 text-xs text-muted-foreground">Post unlocks once the approval is confirmed onchain.</p>
            ) : null}
            {isDirect && !canPost ? (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                Enter a valid worker wallet address to enable the hire.
              </p>
            ) : null}
            {isDirect && canPost && targetHasIdentity === false ? (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                Heads up: this address has no ERC-8004 identity yet — it must register before it can
                claim, or the bounty will sit until you cancel it.
              </p>
            ) : null}
          </>
        )}

        {actionError ? (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FundStep({
  index,
  title,
  description,
  done,
  doneLabel,
  children,
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
  doneLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
          done ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground",
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {done && doneLabel ? (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {doneLabel}
        </span>
      ) : (
        children
      )}
    </li>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function LabelledInput({
  label,
  value,
  error,
  placeholder,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        className={cn(
          "mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2",
          error ? "border-destructive" : "border-input",
        )}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="mt-2 block text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

function validateStep(step: number, values: FormState) {
  const schema = step === 0 ? tokenStepSchema : step === 1 ? linksStepSchema : rulesStepSchema;
  const result = schema.safeParse(values);
  const errors = result.success ? {} : flattenZodErrors(result);
  // Direct hire requires a valid target wallet before leaving the rules step.
  if (step === 2 && values.hireMode === "direct" && !isAddress(values.targetWorker.trim())) {
    return { ok: false, errors: { ...errors, targetWorker: "Enter a valid worker wallet address (0x…)." } };
  }
  return { ok: result.success, errors };
}

function flattenZodErrors(result: z.SafeParseReturnType<unknown, unknown>) {
  if (result.success) return {};
  return result.error.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = String(issue.path[0] ?? "form");
    acc[key] = issue.message;
    return acc;
  }, {});
}

function parseForm(values: FormState, deployment: typeof MAINNET_V3) {
  try {
    const token = tokenConfig(values.token, deployment);
    const amount = parseUnits(values.amount, token.decimals);
    const stake = parseUnits(values.stake, token.decimals);
    // Contract takes `deadline` as a DURATION in seconds from now (it adds
    // block.timestamp on-chain) bounded to MIN_DEADLINE 1d..MAX_DEADLINE 14d —
    // NOT an absolute timestamp.
    const deadlineSeconds = BigInt(Math.floor((Date.parse(values.deadline) - Date.now()) / 1000));
    const requirementsHash = keccak256(
      toBytes(
        JSON.stringify({
          repoUrl: normalizedUrl(values.repoUrl),
          issueUrl: normalizedUrl(values.issueUrl),
          ciRequired: values.ciRequired,
          maxSlots: values.maxSlots,
        }),
      ),
    );

    return { token, amount, stake, deadlineSeconds, requirementsHash };
  } catch {
    return null;
  }
}

function tokenConfig(symbol: TokenSymbol, deployment: typeof MAINNET_V3) {
  const address = deployment.tokens[symbol] as Address;
  return {
    address,
    decimals: symbol === "USDC" ? 6 : 18,
  };
}

function isPositiveDecimal(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return false;
  return Number(value) > 0;
}

function meetsMinAmount(token: TokenSymbol, amount: string) {
  if (!isPositiveDecimal(amount)) return true;
  const decimals = token === "USDC" ? 6 : 18;
  try {
    return parseUnits(amount, decimals) >= parseUnits(TOKEN_MIN[token], decimals);
  } catch {
    return false;
  }
}

function normalizedUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function defaultDeadline() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Invalid deadline";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unable to submit the transaction.";
}
