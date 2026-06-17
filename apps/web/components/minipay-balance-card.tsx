"use client";

import { Wallet } from "lucide-react";
import type { Address } from "viem";
import { formatUnits } from "viem";

import { GlassCard } from "@/components/ui/card";
import { useMiniPayBalance, useMiniPayDetection } from "@/lib/minipay";

export function MiniPayBalanceCard({
  token,
  tokenSymbol,
}: {
  token: Address;
  tokenSymbol: string;
}) {
  const isMiniPay = useMiniPayDetection();
  const { balance, decimals, isLoading } = useMiniPayBalance(token);

  if (!isMiniPay) return null;

  const formatted =
    balance != null ? Number(formatUnits(balance, decimals)).toLocaleString() : null;

  return (
    <GlassCard className="!p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wallet aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">MiniPay balance</p>
          <p className="text-sm font-semibold">
            {isLoading ? "Loading…" : formatted != null ? `${formatted} ${tokenSymbol}` : "-"}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
