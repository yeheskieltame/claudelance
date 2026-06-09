import { fetchTreasuryRevenue, type TokenAmounts } from "@/lib/revenue";
import { getCeloUsdPrice } from "@/lib/price";
import { formatTokenAmount } from "@/lib/format-token";

function usdValue(r: TokenAmounts, celoUsd: number): number {
  return Number(r.cUSD) / 1e18 + Number(r.USDC) / 1e6 + (Number(r.CELO) / 1e18) * celoUsd;
}

export async function RevenueCard() {
  const [r, celoUsd] = await Promise.all([fetchTreasuryRevenue(), getCeloUsdPrice()]);

  const usdTotal = usdValue(r, celoUsd);
  const usdV2 = usdValue(r.v2, celoUsd);
  const usdV3 = usdValue(r.v3, celoUsd);

  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card/50">
      {/* Headline figure */}
      <div className="border-b border-border p-6 sm:p-8">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
          Total protocol revenue · USD
        </p>
        <p className="mt-3 font-mono text-5xl font-bold tracking-tight text-primary tabular-nums sm:text-6xl">
          ${usdTotal.toFixed(2)}
        </p>
        <p className="mt-3 max-w-md font-mono text-[0.7rem] text-muted-foreground/70">
          2% fee on every resolved bounty, plus forfeited stake, summed across
          both live contracts. CELO valued at ${celoUsd.toFixed(2)} (live). cUSD
          and USDC at peg.
        </p>
      </div>

      {/* Per-token breakdown (combined) */}
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
        <PerToken label="cUSD" amount={r.cUSD} decimals={18} accent />
        <PerToken label="CELO" amount={r.CELO} decimals={18} />
        <PerToken label="USDC" amount={r.USDC} decimals={6} />
      </div>

      {/* Per-contract split */}
      <div className="grid grid-cols-2 gap-px bg-border">
        <PerContract
          label="v2 core · code era"
          address="0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423"
          usd={usdV2}
        />
        <PerContract
          label="v3 proxy · task types"
          address="0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8"
          usd={usdV3}
        />
      </div>
    </div>
  );
}

function PerToken({
  label,
  amount,
  decimals,
  accent,
}: {
  label: string;
  amount: bigint;
  decimals: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-card p-5 sm:p-6">
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-mono text-xl font-bold tabular-nums sm:text-2xl ${accent ? "text-primary" : "text-foreground"}`}
      >
        {formatTokenAmount(amount, decimals, 4)}
      </span>
    </div>
  );
}

function PerContract({ label, address, usd }: { label: string; address: string; usd: number }) {
  return (
    <a
      href={`https://celoscan.io/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-1.5 bg-card p-5 transition-colors hover:bg-card/80 sm:p-6"
    >
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-bold tabular-nums text-foreground sm:text-xl">
        ${usd.toFixed(2)}
      </span>
      <span className="font-mono text-[0.65rem] text-muted-foreground/70 group-hover:text-muted-foreground">
        {address.slice(0, 10)}…{address.slice(-6)}
      </span>
    </a>
  );
}
