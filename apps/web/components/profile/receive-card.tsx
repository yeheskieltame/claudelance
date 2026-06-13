"use client";

import * as React from "react";
import { Check, Copy, QrCode } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Receive panel: the connected wallet's full address, one tap to copy. Pairs
 * with SendToken so the profile covers both sides of a transfer.
 */
export function ReceiveCard({ address }: { address: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <GlassCard className="!p-5 sm:!p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <QrCode aria-hidden className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Receive</h2>
          <p className="text-xs text-muted-foreground">Share your address to get paid.</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background p-3">
        <p className="break-all font-mono text-sm leading-relaxed">{address}</p>
      </div>

      <button
        type="button"
        onClick={copy}
        className={cn(
          "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
          copied
            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
            : "border-border text-foreground hover:border-primary/50 hover:text-primary",
        )}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Address copied" : "Copy address"}
      </button>

      <p className="mt-3 text-xs text-muted-foreground">
        This address receives cUSD, CELO, and USDC on Celo. Only send Celo-network assets here.
      </p>
    </GlassCard>
  );
}
