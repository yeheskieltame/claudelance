"use client";

import * as React from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, formatUnits, getAddress, isAddress, parseUnits, type Address, type Hash } from "viem";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { useTransactionToast } from "@/components/transaction-toast";
import { WALLET_TOKENS, tokenBySymbol } from "@/lib/wallet/tokens";
import type { TokenSymbol } from "@/lib/token-theme";
import { TOKEN_BADGE } from "@/lib/token-theme";
import { miniPayFeeCurrency } from "@/lib/wallet/fee-currency";
import { DEFAULT_CHAIN_ID } from "@/lib/chain";
import { cn } from "@/lib/utils";

/**
 * Plain wallet-to-wallet token transfer — the flow MiniPay omits. Picks a token,
 * validates the recipient and amount against the live balance, and sends an
 * ERC-20 transfer (all three tokens, incl. CELO, are ERC-20 on Celo) paying gas
 * in cUSD inside MiniPay via the fee-currency field.
 */
export function SendToken({
  token,
  onTokenChange,
}: {
  token: TokenSymbol;
  onTokenChange: (symbol: TokenSymbol) => void;
}) {
  const { address, isConnected } = useAccount();
  const meta = tokenBySymbol(token);

  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: meta.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const balance = typeof balanceRaw === "bigint" ? balanceRaw : 0n;

  useTransactionToast(txHash, {
    pendingMessage: `Sending ${token}`,
    confirmedMessage: `${token} sent`,
    failedMessage: "Transfer failed",
  });
  const { isSuccess: sent } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });
  React.useEffect(() => {
    if (!sent) return;
    setAmount("");
    setTo("");
    void refetchBalance();
  }, [sent, refetchBalance]);

  const toTrimmed = to.trim();
  const toValid = isAddress(toTrimmed);
  const amountValid = /^\d+(\.\d+)?$/.test(amount.trim()) && Number(amount) > 0;
  const parsedAmount = amountValid ? safeParse(amount, meta.decimals) : null;
  const overBalance = parsedAmount !== null && parsedAmount > balance;
  const sendingToSelf = toValid && address ? getAddress(toTrimmed) === getAddress(address) : false;
  const canSend = isConnected && toValid && amountValid && parsedAmount !== null && !overBalance && !sendingToSelf;

  const setMax = () => setAmount(formatUnits(balance, meta.decimals));

  const submit = async () => {
    setFormError(null);
    if (!canSend || parsedAmount === null) return;
    try {
      const hash = (await writeContractAsync({
        address: meta.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [getAddress(toTrimmed), parsedAmount],
        feeCurrency: miniPayFeeCurrency(),
      })) as Hash;
      setTxHash(hash);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <GlassCard className="!p-5 sm:!p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Send aria-hidden className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Send</h2>
          <p className="text-xs text-muted-foreground">Transfer any balance to another wallet.</p>
        </div>
      </div>

      {/* Token picker */}
      <div className="mt-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Token to send">
        {WALLET_TOKENS.map((t) => {
          const active = t.symbol === token;
          return (
            <button
              key={t.symbol}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onTokenChange(t.symbol)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-colors",
                active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent/40",
              )}
            >
              {t.symbol}
            </button>
          );
        })}
      </div>

      {/* Recipient */}
      <label className="mt-4 block">
        <span className="text-sm font-medium">Recipient address</span>
        <input
          type="text"
          spellCheck={false}
          inputMode="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x…"
          className={cn(
            "mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
            to && !toValid ? "border-destructive" : "border-input",
          )}
        />
        {to && !toValid ? <span className="mt-1.5 block text-xs text-destructive">Enter a valid 0x address.</span> : null}
        {sendingToSelf ? <span className="mt-1.5 block text-xs text-amber-600 dark:text-amber-300">That is your own address.</span> : null}
      </label>

      {/* Amount */}
      <label className="mt-4 block">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Amount</span>
          <span className="text-xs text-muted-foreground">
            Balance:{" "}
            <button type="button" onClick={setMax} className="font-mono text-foreground underline-offset-2 hover:underline">
              {Number(formatUnits(balance, meta.decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 })} {token}
            </button>
          </span>
        </div>
        <div className="relative mt-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className={cn(
              "w-full rounded-xl border bg-background px-3 py-2.5 pr-16 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
              overBalance ? "border-destructive" : "border-input",
            )}
          />
          <button
            type="button"
            onClick={setMax}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Max
          </button>
        </div>
        {overBalance ? <span className="mt-1.5 block text-xs text-destructive">Amount exceeds your {token} balance.</span> : null}
      </label>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1", TOKEN_BADGE[token])}>{token}</span>
        <span className="text-xs text-muted-foreground">
          Transfers are final and irreversible. Double-check the address.
        </span>
      </div>

      <Button type="button" className="mt-4 w-full" onClick={submit} disabled={!canSend || isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {isPending ? "Sending" : isConnected ? `Send ${token}` : "Connect a wallet to send"}
      </Button>

      {formError ? (
        <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
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
  if (error && typeof error === "object" && "shortMessage" in error) {
    return String((error as { shortMessage: unknown }).shortMessage);
  }
  if (error instanceof Error) return error.message;
  return "Unable to send the transaction.";
}
