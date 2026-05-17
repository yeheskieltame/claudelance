import { fetchTreasuryRevenue } from "@/lib/revenue";
import { tokenToUsd } from "@/lib/usd-conversion";

export async function RevenueCard() {
  const r = await fetchTreasuryRevenue();
  const usdTotal =
    tokenToUsd("cUSD", r.cUSD) +
    tokenToUsd("CELO", r.CELO) +
    tokenToUsd("USDC", r.USDC);

  return (
    <div className="premium-panel mt-10 rounded-2xl p-8">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        Total treasury revenue
      </h2>
      <p className="mt-2 text-5xl font-bold text-gradient">
        ${usdTotal.toFixed(2)} USD
      </p>
      <p className="text-xs text-muted-foreground">
        Per-token amounts below sum to the headline; CELO converted at $0.08
        (Mento oracle snapshot; replace with live feed in a future PR).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <PerToken label="cUSD" amount={r.cUSD} decimals={18} />
        <PerToken label="CELO" amount={r.CELO} decimals={18} />
        <PerToken label="USDC" amount={r.USDC} decimals={6} />
      </div>
    </div>
  );
}

function PerToken({
  label,
  amount,
  decimals,
}: {
  label: string;
  amount: bigint;
  decimals: number;
}) {
  const float = Number(amount) / 10 ** decimals;
  return (
    <div className="rounded-2xl border border-border/75 bg-card/55 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{float.toFixed(4)}</div>
    </div>
  );
}
