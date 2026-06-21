"use client";

import * as React from "react";
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { ArrowUpRight, RefreshCw } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { WALLET_TOKENS } from "@/lib/wallet/tokens";
import { TOKEN_BADGE } from "@/lib/token-theme";
import { DEFAULT_CHAIN_ID } from "@/lib/chain";
import { cn } from "@/lib/utils";

function formatBalance(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/**
 * Connected wallet's balances across the wallet tokens. One
 * multicall per render; "Send" hands the chosen token up to the send form.
 */
export function AssetList({ onSend }: { onSend?: (symbol: (typeof WALLET_TOKENS)[number]["symbol"]) => void }) {
  const { address, isConnected } = useAccount();

  const { data, isLoading, refetch, isRefetching } = useReadContracts({
    allowFailure: true,
    contracts: WALLET_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] : undefined,
      chainId: DEFAULT_CHAIN_ID,
    })),
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  return (
    <GlassCard className="!p-5 sm:!p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Your assets</h2>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={!isConnected || isRefetching}
          aria-label="Refresh balances"
          className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} aria-hidden />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {WALLET_TOKENS.map((token, i) => {
          const result = data?.[i];
          const raw = result?.status === "success" ? (result.result as bigint) : 0n;
          const showLoading = isLoading && !data;
          return (
            <div
              key={token.symbol}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-3"
            >
              <div className="flex items-center gap-3">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", TOKEN_BADGE[token.symbol])}>
                  {token.symbol}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold tabular-nums">
                    {showLoading ? (
                      <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted align-middle" />
                    ) : (
                      formatBalance(raw, token.decimals)
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{token.name}</p>
                </div>
              </div>
              {onSend ? (
                <button
                  type="button"
                  onClick={() => onSend(token.symbol)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  Send
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
