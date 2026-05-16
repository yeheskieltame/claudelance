"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BountyStatus,
  CLAUDELANCE_CORE_ABI,
  MAINNET,
  SEPOLIA,
  ZERO_ADDRESS,
  deploymentByChainId,
} from "@yeheskieltame/claudelance-types";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  Send,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import type { Address, Hash } from "viem";
import { createConfig, http, injected, useAccount, useConnect, useDisconnect, useWriteContract, WagmiProvider } from "wagmi";

import { Button } from "@/components/ui/button";
import { useTransactionToast } from "@/components/transaction-toast";
import { celoMainnet, celoSepolia, DEFAULT_CHAIN_ID, supportedChains } from "@/lib/chain";
import { cn } from "@/lib/utils";

type ApiBounty = {
  id: string;
  poster: Address;
  amount: string;
  winner: Address;
  stakeRequired: string;
  token: Address;
  deadline: string;
  maxSlots: number;
  claimedSlots: number;
  bountyType: number;
  ciRequired: boolean;
  targetWorker: Address;
  status: number | string;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash: `0x${string}`;
  claimers?: Address[];
  submissions?: ApiSubmission[];
  chainId?: number;
};

type ApiSubmission = {
  worker: Address;
  commitHash: `0x${string}`;
  submittedAt: string;
  ciPassed: boolean;
  stakeRefunded: boolean;
  prUrl: string;
  metadata: string;
};

type TxMode = "claim" | "submit" | "pick";

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected({ shimDisconnect: true })],
  ssr: true,
  transports: {
    [celoSepolia.id]: http(process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC),
    [celoMainnet.id]: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
  },
});

const statusLabels = ["Open", "Resolved", "Cancelled", "Expired"] as const;

export function BountyDetailPage({ bountyId }: { bountyId: string }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BountyDetail bountyId={bountyId} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function BountyDetail({ bountyId }: { bountyId: string }) {
  const [bounty, setBounty] = React.useState<ApiBounty | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    setBounty(null);

    fetch(`/api/bounty/${encodeURIComponent(bountyId)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ApiBounty | { error?: string } | null;
        if (!response.ok) {
          throw new Error(payload && "error" in payload && payload.error ? payload.error : "Unable to load bounty");
        }
        setBounty(payload as ApiBounty);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load bounty");
      });

    return () => controller.abort();
  }, [bountyId, reloadKey]);

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-4 py-10 sm:px-6">
        <section className="w-full rounded-lg border border-destructive/30 bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <h1 className="text-2xl font-semibold">Bounty unavailable</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{loadError}</p>
              <Button className="mt-5" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
                <Loader2 className="h-4 w-4" aria-hidden />
                Retry
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!bounty) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 h-56 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-lg bg-muted" />
          <div className="h-28 animate-pulse rounded-lg bg-muted" />
          <div className="h-28 animate-pulse rounded-lg bg-muted" />
        </div>
      </main>
    );
  }

  return <BountyDetailContent bounty={bounty} />;
}

function BountyDetailContent({ bounty }: { bounty: ApiBounty }) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  const [txMode, setTxMode] = React.useState<TxMode>("claim");
  const [actionError, setActionError] = React.useState<string | null>(null);

  const bountyId = BigInt(bounty.id);
  const desiredChainId = bounty.chainId ?? DEFAULT_CHAIN_ID;
  const deployment = deploymentByChainId(desiredChainId) ?? deploymentByChainId(DEFAULT_CHAIN_ID) ?? SEPOLIA;
  const writeChainId = deployment.chainId as typeof celoSepolia.id | typeof celoMainnet.id;
  const connectedAddress = address?.toLowerCase();
  const claimers = bounty.claimers ?? [];
  const submissions = bounty.submissions ?? [];
  const submitted = submissions.filter(hasSubmitted);
  const ownSubmission = connectedAddress
    ? submissions.find((submission) => submission.worker.toLowerCase() === connectedAddress && hasSubmitted(submission))
    : undefined;
  const isPoster = connectedAddress ? bounty.poster.toLowerCase() === connectedAddress : false;
  const isClaimer = connectedAddress ? claimers.some((claimer) => claimer.toLowerCase() === connectedAddress) : false;
  const isOpen = getStatusCode(bounty.status) === BountyStatus.Open;
  const hasSlots = bounty.claimedSlots < bounty.maxSlots;
  const branch = getRoleBranch({ isPoster, isOpen, hasSubmissions: submitted.length > 0, isClaimer, ownSubmission });

  useTransactionToast(txHash, {
    chainId: writeChainId,
    pendingMessage: txCopy[txMode].pending,
    confirmedMessage: txCopy[txMode].confirmed,
    failedMessage: txCopy[txMode].failed,
    toastId: txHash ? `b49:${txMode}:${txHash}` : undefined,
  });

  const connectInjected = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  const sendClaim = async () => {
    setActionError(null);
    setTxMode("claim");
    try {
      const hash = await writeContractAsync({
        address: deployment.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "claimSlot",
        args: [bountyId],
        chainId: writeChainId,
      });
      setTxHash(hash);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const sendSubmission = async (values: SubmitPrValues) => {
    setActionError(null);
    setTxMode("submit");
    try {
      const hash = await writeContractAsync({
        address: deployment.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "submitPR",
        args: [bountyId, values.prUrl, normalizeCommitHash(values.commitHash), values.metadata],
        chainId: writeChainId,
      });
      setTxHash(hash);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const sendPickWinner = async (winner: Address) => {
    setActionError(null);
    setTxMode("pick");
    try {
      const hash = await writeContractAsync({
        address: deployment.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "pickWinner",
        args: [bountyId, winner],
        chainId: writeChainId,
      });
      setTxHash(hash);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <a href="/bounties" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Back to bounties
        </a>
        <WalletStrip
          address={address}
          chainName={deployment.chainName}
          isConnected={isConnected}
          isConnecting={isConnecting}
          onConnect={connectInjected}
          onDisconnect={() => disconnect()}
        />
      </div>

      <section className="mt-6 rounded-lg border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Bounty #{bounty.id}
              </span>
              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", statusClassName(bounty.status))}>
                {statusLabel(bounty.status)}
              </span>
              <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
                {bounty.claimedSlots}/{bounty.maxSlots} slots
              </span>
            </div>
            <h1 className="mt-4 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
              {repoTitle(bounty.targetRepoUrl)}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              {bounty.ciRequired ? "CI verified" : "Manual review"} bounty with reward escrow and role-aware actions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-72">
            <Metric label="Reward" value={formatAmount(bounty.amount, bounty.token)} />
            <Metric label="Stake" value={formatAmount(bounty.stakeRequired, bounty.token)} />
            <Metric label="Deadline" value={formatDeadline(bounty.deadline)} />
            <Metric label="Network" value={deployment.chainName.replace("celo-", "")} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <InfoLink href={bounty.targetRepoUrl} label="Repository" />
          <InfoLink href={bounty.instructionUrl} label="Instructions" />
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border bg-card p-5 shadow-sm sm:p-6" data-role-branch={branch}>
          <div className="flex items-center gap-3">
            {branch === "poster-pick-winner" ? (
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
            ) : branch === "worker-submit-pr" ? (
              <Send className="h-5 w-5 text-sky-500" aria-hidden />
            ) : (
              <GitBranch className="h-5 w-5 text-emerald-500" aria-hidden />
            )}
            <div>
              <h2 className="text-xl font-semibold">{roleHeading(branch)}</h2>
              <p className="text-sm text-muted-foreground">{roleDescription(branch, isConnected)}</p>
            </div>
          </div>

          {!isConnected ? (
            <ConnectGate isConnecting={isConnecting} onConnect={connectInjected} />
          ) : branch === "poster-pick-winner" ? (
            <PickWinnerPanel submissions={submitted} isWriting={isWriting} onPick={sendPickWinner} />
          ) : branch === "worker-submit-pr" ? (
            <SubmitPrPanel isWriting={isWriting} onSubmit={sendSubmission} />
          ) : (
            <ClaimSlotPanel
              bounty={bounty}
              hasSlots={hasSlots}
              isOpen={isOpen}
              isWriting={isWriting}
              onClaim={sendClaim}
            />
          )}

          {ownSubmission ? (
            <div className="mt-5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
              <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden />
              Your PR submission is already recorded for this bounty.
            </div>
          ) : null}

          {actionError ? (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}
        </section>

        <aside className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Participants</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <AddressRow label="Poster" address={bounty.poster} />
            <AddressRow label="Winner" address={isZeroAddress(bounty.winner) ? null : bounty.winner} />
            <AddressRow label="Direct hire" address={isZeroAddress(bounty.targetWorker) ? null : bounty.targetWorker} />
          </dl>

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Submissions</h3>
          <div className="mt-3 space-y-3">
            {submitted.length > 0 ? (
              submitted.map((submission) => <SubmissionRow key={submission.worker} submission={submission} />)
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No PR submissions have been recorded yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function WalletStrip({
  address,
  chainName,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
}: {
  address?: Address;
  chainName: string;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
      <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
      {isConnected && address ? (
        <>
          <span className="font-medium">{shortAddress(address)}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{chainName}</span>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={onDisconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <Button size="sm" onClick={onConnect} disabled={isConnecting}>
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}
          Connect
        </Button>
      )}
    </div>
  );
}

function ConnectGate({ isConnecting, onConnect }: { isConnecting: boolean; onConnect: () => void }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed p-5">
      <p className="text-sm leading-6 text-muted-foreground">Connect a wallet to reveal the action for your role.</p>
      <Button className="mt-4" onClick={onConnect} disabled={isConnecting}>
        {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}
        Connect wallet
      </Button>
    </div>
  );
}

function ClaimSlotPanel({
  bounty,
  hasSlots,
  isOpen,
  isWriting,
  onClaim,
}: {
  bounty: ApiBounty;
  hasSlots: boolean;
  isOpen: boolean;
  isWriting: boolean;
  onClaim: () => void;
}) {
  const disabled = !isOpen || !hasSlots || isWriting;
  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Claiming reserves a worker slot. The ERC-8004 identity gate and any stake checks are enforced by the contract.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onClaim} disabled={disabled}>
          {isWriting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GitBranch className="h-4 w-4" aria-hidden />}
          Claim slot
        </Button>
        {bounty.instructionUrl ? (
          <Button asChild variant="outline">
            <a href={bounty.instructionUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Instructions
            </a>
          </Button>
        ) : null}
      </div>
      {!isOpen || !hasSlots ? (
        <p className="text-sm text-muted-foreground">
          {isOpen ? "All worker slots are already claimed." : "This bounty is not open for new claims."}
        </p>
      ) : null}
    </div>
  );
}

type SubmitPrValues = {
  prUrl: string;
  commitHash: string;
  metadata: string;
};

function SubmitPrPanel({
  isWriting,
  onSubmit,
}: {
  isWriting: boolean;
  onSubmit: (values: SubmitPrValues) => Promise<void>;
}) {
  const [values, setValues] = React.useState<SubmitPrValues>({ prUrl: "", commitHash: "", metadata: "" });
  const [formError, setFormError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!/^https:\/\/github\.com\/.+\/pull\/\d+/i.test(values.prUrl.trim())) {
      setFormError("Enter a GitHub pull request URL.");
      return;
    }

    try {
      normalizeCommitHash(values.commitHash);
    } catch (error) {
      setFormError(getErrorMessage(error));
      return;
    }

    await onSubmit({
      prUrl: values.prUrl.trim(),
      commitHash: values.commitHash.trim(),
      metadata: values.metadata.trim(),
    });
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <LabelledInput
        label="Pull request URL"
        value={values.prUrl}
        placeholder="https://github.com/owner/repo/pull/123"
        onChange={(prUrl) => setValues((current) => ({ ...current, prUrl }))}
      />
      <LabelledInput
        label="Commit hash"
        value={values.commitHash}
        placeholder="40 or 64 hex characters"
        onChange={(commitHash) => setValues((current) => ({ ...current, commitHash }))}
      />
      <label className="block">
        <span className="text-sm font-medium">Metadata</span>
        <textarea
          className="mt-2 min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={values.metadata}
          placeholder='{"ci":"passed","notes":"ready for review"}'
          onChange={(event) => setValues((current) => ({ ...current, metadata: event.target.value }))}
        />
      </label>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <Button type="submit" disabled={isWriting}>
        {isWriting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        Submit PR
      </Button>
    </form>
  );
}

function PickWinnerPanel({
  submissions,
  isWriting,
  onPick,
}: {
  submissions: ApiSubmission[];
  isWriting: boolean;
  onPick: (winner: Address) => Promise<void>;
}) {
  const [winner, setWinner] = React.useState<Address>(submissions[0]?.worker ?? ZERO_ADDRESS);

  React.useEffect(() => {
    if (isZeroAddress(winner) && submissions[0]) setWinner(submissions[0].worker);
  }, [submissions, winner]);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isZeroAddress(winner)) void onPick(winner);
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">Winning worker</span>
        <select
          className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={winner}
          onChange={(event) => setWinner(event.target.value as Address)}
        >
          {submissions.map((submission) => (
            <option key={submission.worker} value={submission.worker}>
              {shortAddress(submission.worker)} - {submission.prUrl}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={isWriting || submissions.length === 0 || isZeroAddress(winner)}>
        {isWriting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trophy className="h-4 w-4" aria-hidden />}
        Pick winner
      </Button>
    </form>
  );
}

function LabelledInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}

function InfoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-background/60 px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <span className="min-w-0 truncate">{label}</span>
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
    </a>
  );
}

function AddressRow({ label, address }: { label: string; address: Address | null }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 break-all font-mono text-xs">{address ? address : "None"}</dd>
    </div>
  );
}

function SubmissionRow({ submission }: { submission: ApiSubmission }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs">{shortAddress(submission.worker)}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs", submission.ciPassed ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-amber-500/10 text-amber-700 dark:text-amber-200")}>
          {submission.ciPassed ? "CI passed" : "CI pending"}
        </span>
      </div>
      {submission.prUrl ? (
        <a className="mt-2 block truncate text-xs text-primary hover:underline" href={submission.prUrl} target="_blank" rel="noreferrer">
          {submission.prUrl}
        </a>
      ) : null}
    </div>
  );
}

function getRoleBranch({
  isPoster,
  isOpen,
  hasSubmissions,
  isClaimer,
  ownSubmission,
}: {
  isPoster: boolean;
  isOpen: boolean;
  hasSubmissions: boolean;
  isClaimer: boolean;
  ownSubmission?: ApiSubmission;
}) {
  if (isPoster && isOpen && hasSubmissions) return "poster-pick-winner";
  if (isClaimer && !ownSubmission) return "worker-submit-pr";
  return "visitor-claim-slot";
}

function roleHeading(branch: ReturnType<typeof getRoleBranch>) {
  if (branch === "poster-pick-winner") return "Pick winner";
  if (branch === "worker-submit-pr") return "Submit PR";
  return "Claim slot";
}

function roleDescription(branch: ReturnType<typeof getRoleBranch>, isConnected: boolean) {
  if (!isConnected) return "Connect to resolve your poster, worker, or visitor role.";
  if (branch === "poster-pick-winner") return "You posted this open bounty and can select from recorded submissions.";
  if (branch === "worker-submit-pr") return "You already claimed a slot and can attach your pull request.";
  return "Reserve a worker slot before submitting a pull request.";
}

function hasSubmitted(submission: ApiSubmission) {
  return submission.prUrl.trim().length > 0 || BigInt(submission.submittedAt || "0") > 0n;
}

function statusLabel(status: ApiBounty["status"]) {
  if (typeof status === "string") return status[0]?.toUpperCase() + status.slice(1);
  return statusLabels[status] ?? "Unknown";
}

function statusClassName(status: ApiBounty["status"]) {
  const code = getStatusCode(status);
  if (code === BountyStatus.Open) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  if (code === BountyStatus.Resolved) return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200";
  return "border-muted bg-muted text-muted-foreground";
}

function getStatusCode(status: ApiBounty["status"]) {
  if (typeof status === "number") return status;
  const normalized = status.toLowerCase();
  if (normalized === "open") return BountyStatus.Open;
  if (normalized === "resolved") return BountyStatus.Resolved;
  if (normalized === "cancelled") return BountyStatus.Cancelled;
  return BountyStatus.Expired;
}

function repoTitle(targetRepoUrl: string) {
  try {
    const url = new URL(targetRepoUrl);
    const [owner, repo] = url.pathname.replace(/^\/|\/$/g, "").split("/");
    return owner && repo ? `${owner}/${repo}` : url.hostname;
  } catch {
    return targetRepoUrl.replace(/^https?:\/\//, "") || "Bounty detail";
  }
}

function formatAmount(amount: string, token: Address) {
  const decimals = tokenDecimals(token);
  const value = BigInt(amount);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const trimmed = fraction.toString().padStart(decimals, "0").slice(0, 3).replace(/0+$/, "");
  return `${trimmed ? `${whole}.${trimmed}` : whole.toString()} ${tokenSymbol(token)}`;
}

function tokenSymbol(token: Address) {
  const normalized = token.toLowerCase();
  const entries = [
    ["cUSD", MAINNET.tokens.cUSD, SEPOLIA.tokens.cUSD],
    ["CELO", MAINNET.tokens.CELO, SEPOLIA.tokens.CELO],
    ["USDC", MAINNET.tokens.USDC, SEPOLIA.tokens.USDC],
  ] as const;
  return entries.find(([, mainnet, sepolia]) => normalized === mainnet.toLowerCase() || normalized === sepolia.toLowerCase())?.[0] ?? "TOKEN";
}

function tokenDecimals(token: Address) {
  return tokenSymbol(token) === "USDC" ? 6 : 18;
}

function formatDeadline(deadline: string) {
  const ms = Number(BigInt(deadline)) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "No deadline";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(ms);
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isZeroAddress(address: Address) {
  return address.toLowerCase() === ZERO_ADDRESS;
}

function normalizeCommitHash(value: string): `0x${string}` {
  const hex = value.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Commit hash must be 40 or 64 hex characters.");
  }
  return `0x${hex.padEnd(64, "0")}` as `0x${string}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unable to submit the transaction.";
}

const txCopy: Record<TxMode, { pending: string; confirmed: string; failed: string }> = {
  claim: {
    pending: "Claiming bounty slot",
    confirmed: "Slot claimed",
    failed: "Claim transaction failed",
  },
  submit: {
    pending: "Submitting pull request",
    confirmed: "Pull request submitted",
    failed: "Submit transaction failed",
  },
  pick: {
    pending: "Picking bounty winner",
    confirmed: "Winner picked",
    failed: "Pick winner transaction failed",
  },
};
