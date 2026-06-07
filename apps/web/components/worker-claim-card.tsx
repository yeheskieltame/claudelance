"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Coins, Loader2 } from "lucide-react";
import type { Address, Hash } from "viem";
import { CLAUDELANCE_CORE_V3_ABI, MAINNET_V3 } from "@yeheskieltame/claudelance-types";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { useTransactionToast } from "@/components/transaction-toast";
import { formatTokenAmount } from "@/lib/format-token";
import { miniPayFeeCurrency } from "@/lib/wallet/fee-currency";
import { TOKEN_BADGE } from "@/lib/token-theme";
import { cn } from "@/lib/utils";

// bigint is not serializable across the server/client boundary, so amounts
// arrive as wei strings.
export type ClaimRow = {
  symbol: "cUSD" | "CELO" | "USDC";
  token: Address;
  amount: string;
  decimals: number;
};

/**
 * Self-service reward claim. Renders only when the connected wallet is the
 * worker whose profile this is. withdrawEarnings is scoped to msg.sender, so
 * the wallet can only ever pull its own balance: that is the gate.
 */
export function WorkerClaimCard({
  pageAddress,
  claimable,
}: {
  pageAddress: string;
  claimable: ClaimRow[];
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = React.useState<Hash | null>(null);
  const [busyToken, setBusyToken] = React.useState<string | null>(null);

  useTransactionToast(txHash, {
    pendingMessage: "Claiming earnings",
    confirmedMessage: "Earnings sent to your wallet",
    failedMessage: "Claim failed (nothing to withdraw?)",
  });
  const { isSuccess: claimed } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });
  React.useEffect(() => {
    if (claimed) router.refresh();
  }, [claimed, router]);

  const isOwner = isConnected && !!address && address.toLowerCase() === pageAddress.toLowerCase();
  if (!isOwner) return null;

  const core = MAINNET_V3.core as Address;
  const positive = claimable.filter((r) => BigInt(r.amount) > 0n);

  const withdraw = async (token: Address, key: string) => {
    setBusyToken(key);
    try {
      const hash = (await writeContractAsync({
        address: core,
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: "withdrawEarnings",
        args: [token],
        feeCurrency: miniPayFeeCurrency(),
      })) as Hash;
      setTxHash(hash);
    } catch {
      // user rejected, or nothing to withdraw for this token
    } finally {
      setBusyToken(null);
    }
  };

  const claimAll = async () => {
    for (const r of positive) {
      await withdraw(r.token, r.symbol);
    }
  };

  return (
    <GlassCard className="!p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <Coins aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Claim your earnings</h2>
          <p className="text-xs text-muted-foreground">
            Connected as this worker. Pull rewards straight to your wallet, no agent or CLI needed.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {claimable.map((r) => {
          const wei = BigInt(r.amount);
          const has = wei > 0n;
          const busy = busyToken === r.symbol;
          return (
            <div
              key={r.symbol}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", TOKEN_BADGE[r.symbol])}>
                  {r.symbol}
                </span>
                <span className="font-mono text-sm">{has ? formatTokenAmount(wei, r.decimals, 6) : "0"}</span>
              </div>
              <Button
                size="sm"
                variant={has ? "primary" : "outline"}
                onClick={() => withdraw(r.token, r.symbol)}
                disabled={isPending}
                title={has ? `Claim ${r.symbol}` : `Force a ${r.symbol} withdrawal`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Claim"}
              </Button>
            </div>
          );
        })}
      </div>

      {positive.length > 1 ? (
        <Button className="mt-4 w-full" onClick={claimAll} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : `Claim all (${positive.length} tokens)`}
        </Button>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Amounts are reconstructed from on-chain events. The withdraw transaction always pulls your exact balance, so a
        token showing 0 can still be force-claimed.
      </p>
    </GlassCard>
  );
}
