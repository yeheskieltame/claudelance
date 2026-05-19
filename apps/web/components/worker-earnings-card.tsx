import { Coins } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { formatTokenAmount } from "@/lib/format-token";
import { TOKEN_BADGE } from "@/lib/token-theme";
import { cn } from "@/lib/utils";
import type { TokenEarnings } from "@/lib/worker-stats";

const DECIMALS: Record<TokenEarnings["symbol"], number> = {
  cUSD: 18,
  CELO: 18,
  USDC: 6,
};

export function WorkerEarningsCard({ earnings }: { earnings: TokenEarnings[] }) {
  const hasAny = earnings.some((e) => e.amount > 0n);

  return (
    <GlassCard className="!p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <Coins aria-hidden="true" className="h-4 w-4" />
        </span>
        <h2 className="font-display text-lg font-semibold">
          Pending earnings (on-protocol)
        </h2>
      </div>
      {hasAny ? (
        <ul className="mt-4 space-y-2 text-sm">
          {earnings.map((row) => {
            if (row.amount === 0n) return null;
            const formatted = formatTokenAmount(row.amount, DECIMALS[row.symbol], 6);
            return (
              <li
                key={row.symbol}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                    TOKEN_BADGE[row.symbol],
                  )}
                >
                  {row.symbol}
                </span>
                <span className="font-mono">{formatted}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing pending. Resolved bounty rewards land here before
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">withdrawEarnings</code>
          pulls them to the wallet.
        </p>
      )}
    </GlassCard>
  );
}

