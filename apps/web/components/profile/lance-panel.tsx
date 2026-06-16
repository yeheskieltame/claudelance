"use client";

import * as React from "react";
import { useAccount, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, formatUnits, maxUint256, parseUnits, type Hash } from "viem";
import { Coins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { useTransactionToast } from "@/components/transaction-toast";
import { miniPayFeeCurrency } from "@/lib/wallet/fee-currency";
import { DEFAULT_CHAIN_ID } from "@/lib/chain";
import { cn } from "@/lib/utils";
import { LANCE_ADDRESS, LANCE_ASSET, LANCE_ASSET_SYMBOL, LANCE_DECIMALS, lanceAbi } from "@/lib/lance";

const WAD = 10n ** 18n;
type Mode = "buy" | "redeem";

/**
 * Buy / redeem $LANCE — the internal economy credit. Buy = deposit CELO into the
 * Lance Hub (mint at NAV); redeem = burn $LANCE back to CELO minus a small fee.
 * $LANCE is what BingoChain games and Claudelance bounties can settle in.
 */
export function LancePanel() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: DEFAULT_CHAIN_ID });
  const { writeContractAsync, isPending } = useWriteContract();

  const [mode, setMode] = React.useState<Mode>("buy");
  const [amount, setAmount] = React.useState("");
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const { data: celoRaw, refetch: refetchCelo } = useReadContract({
    address: LANCE_ASSET, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: DEFAULT_CHAIN_ID, query: { enabled: Boolean(address) },
  });
  const { data: lanceRaw, refetch: refetchLance } = useReadContract({
    address: LANCE_ADDRESS, abi: lanceAbi, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: DEFAULT_CHAIN_ID, query: { enabled: Boolean(address) },
  });
  const { data: navRaw } = useReadContract({ address: LANCE_ADDRESS, abi: lanceAbi, functionName: "nav", chainId: DEFAULT_CHAIN_ID });
  const { data: feeRaw } = useReadContract({ address: LANCE_ADDRESS, abi: lanceAbi, functionName: "redeemFeeBps", chainId: DEFAULT_CHAIN_ID });
  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: LANCE_ASSET, abi: erc20Abi, functionName: "allowance",
    args: address ? [address, LANCE_ADDRESS] : undefined, chainId: DEFAULT_CHAIN_ID, query: { enabled: Boolean(address) },
  });

  const celo = typeof celoRaw === "bigint" ? celoRaw : 0n;
  const lance = typeof lanceRaw === "bigint" ? lanceRaw : 0n;
  const nav = typeof navRaw === "bigint" && navRaw > 0n ? navRaw : WAD / 1000n; // CELO per $LANCE (1e18)
  const feeBps = typeof feeRaw === "number" ? feeRaw : 100;

  useTransactionToast(txHash, {
    pendingMessage: mode === "buy" ? "Buying $LANCE" : "Redeeming $LANCE",
    confirmedMessage: mode === "buy" ? "$LANCE bought" : "Redeemed to CELO",
    failedMessage: mode === "buy" ? "Buy failed" : "Redeem failed",
  });
  const { isSuccess: done } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });
  React.useEffect(() => {
    if (!done) return;
    setAmount("");
    void refetchCelo();
    void refetchLance();
    void refetchAllowance();
  }, [done, refetchCelo, refetchLance, refetchAllowance]);

  const balance = mode === "buy" ? celo : lance;
  const amountValid = /^\d+(\.\d+)?$/.test(amount.trim()) && Number(amount) > 0;
  const parsed = amountValid ? safeParse(amount, mode === "buy" ? 18 : LANCE_DECIMALS) : null;
  const overBalance = parsed !== null && parsed > balance;
  const canSubmit = isConnected && amountValid && parsed !== null && !overBalance && !busy && !isPending;

  // estimated output (preview, "≈"): buy → $LANCE out; redeem → CELO out (after fee)
  const preview =
    parsed === null
      ? 0n
      : mode === "buy"
        ? (parsed * WAD) / nav
        : (parsed * nav * BigInt(10_000 - feeBps)) / (WAD * 10_000n);

  const submit = async () => {
    setFormError(null);
    if (!canSubmit || parsed === null || !address) return;
    setBusy(true);
    try {
      if (mode === "buy") {
        const allowance = typeof allowanceRaw === "bigint" ? allowanceRaw : 0n;
        if (allowance < parsed) {
          const approveHash = (await writeContractAsync({
            address: LANCE_ASSET, abi: erc20Abi, functionName: "approve", args: [LANCE_ADDRESS, maxUint256], feeCurrency: miniPayFeeCurrency(),
          })) as Hash;
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
        }
        const hash = (await writeContractAsync({
          address: LANCE_ADDRESS, abi: lanceAbi, functionName: "deposit", args: [parsed, address], feeCurrency: miniPayFeeCurrency(),
        })) as Hash;
        setTxHash(hash);
      } else {
        const hash = (await writeContractAsync({
          address: LANCE_ADDRESS, abi: lanceAbi, functionName: "redeem", args: [parsed, address, address], feeCurrency: miniPayFeeCurrency(),
        })) as Hash;
        setTxHash(hash);
      }
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: bigint, d = 18, max = 4) => Number(formatUnits(v, d)).toLocaleString("en-US", { maximumFractionDigits: max });
  const rate = fmt((WAD * WAD) / nav, 18, 0); // $LANCE per 1 CELO

  return (
    <GlassCard className="!p-5 sm:!p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Coins aria-hidden className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">$LANCE</h2>
          <p className="text-xs text-muted-foreground">Buy or redeem the economy credit · ~{rate} LANCE / CELO</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border bg-background px-3 py-2">
          <div className="text-muted-foreground">Your $LANCE</div>
          <div className="mt-0.5 font-mono text-sm font-semibold">{fmt(lance)}</div>
        </div>
        <div className="rounded-xl border border-border bg-background px-3 py-2">
          <div className="text-muted-foreground">Your CELO</div>
          <div className="mt-0.5 font-mono text-sm font-semibold">{fmt(celo)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Buy or redeem">
        {(["buy", "redeem"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => { setMode(m); setAmount(""); setFormError(null); }}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-center text-sm font-semibold capitalize transition-colors",
              mode === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent/40",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{mode === "buy" ? "Spend CELO" : "Redeem $LANCE"}</span>
          <span className="text-xs text-muted-foreground">
            Balance:{" "}
            <button type="button" onClick={() => setAmount(formatUnits(balance, mode === "buy" ? 18 : LANCE_DECIMALS))} className="font-mono text-foreground underline-offset-2 hover:underline">
              {fmt(balance, mode === "buy" ? 18 : LANCE_DECIMALS, 6)} {mode === "buy" ? LANCE_ASSET_SYMBOL : "LANCE"}
            </button>
          </span>
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className={cn(
            "mt-2 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
            overBalance ? "border-destructive" : "border-input",
          )}
        />
        {overBalance ? <span className="mt-1.5 block text-xs text-destructive">Amount exceeds your balance.</span> : null}
      </label>

      <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        {mode === "buy" ? (
          <>You receive ≈ <span className="font-mono text-foreground">{fmt(preview)}</span> $LANCE</>
        ) : (
          <>You receive ≈ <span className="font-mono text-foreground">{fmt(preview)}</span> CELO <span className="opacity-70">(after {(feeBps / 100).toFixed(2)}% fee)</span></>
        )}
      </div>

      <Button type="button" className="mt-4 w-full" onClick={submit} disabled={!canSubmit}>
        {busy || isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Coins className="h-4 w-4" aria-hidden />}
        {busy || isPending ? "Working" : isConnected ? (mode === "buy" ? "Buy $LANCE" : "Redeem to CELO") : "Connect a wallet"}
      </Button>

      {formError ? (
        <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>
      ) : null}
    </GlassCard>
  );
}

function safeParse(value: string, decimals: number): bigint | null {
  try {
    return parseUnits(value as `${number}`, decimals);
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "shortMessage" in error) return String((error as { shortMessage: unknown }).shortMessage);
  if (error instanceof Error) return error.message;
  return "Unable to complete the transaction.";
}
