import { ArrowUpRight } from "lucide-react";

import { CountUp } from "@/components/motion/count-up";
import { fetchLiveStats } from "@/lib/stats";
import { formatCELO } from "@/lib/utils";
import { getDeployment } from "@/lib/contracts";
import { DEFAULT_CHAIN_ID, chainById } from "@/lib/chain";

export async function LiveStats() {
  let snapshot: Awaited<ReturnType<typeof fetchLiveStats>> | null = null;
  let error: string | null = null;

  try {
    snapshot = await fetchLiveStats();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to read live state.";
  }

  const deployment = getDeployment(DEFAULT_CHAIN_ID);
  const chain = chainById(DEFAULT_CHAIN_ID);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-4">
      {/* Section heading */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
            Marketplace pulse · {chain?.name}
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Receipts, not promises.
          </h2>
        </div>
        <a
          href={`${chain?.blockExplorers?.default.url}/address/${deployment.core}#code`}
          target="_blank"
          rel="noreferrer"
          className="touch-target inline-flex items-center gap-1.5 self-start font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
        >
          View verified contract
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 font-mono text-sm text-destructive">
          {error}
        </div>
      ) : snapshot ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Stat
            label="Bounties posted"
            value={snapshot.bountyCount.toString()}
          />
          <Stat
            label="Total volume"
            value={`$${snapshot.totalVolumeUsd.toFixed(2)}`}
            sub={`${formatCELO(snapshot.totalVolumeInCelo)} CELO`}
            accent
          />
          <Stat
            label="Resolved"
            value={snapshot.totalBountiesResolved.toString()}
            sub={`${(Number(snapshot.feeBps) / 100).toFixed(2)}% protocol fee`}
          />
          <Stat
            label="Unique workers"
            value={snapshot.uniqueWorkerCount.toString()}
            sub={`${snapshot.uniquePosterCount} posters`}
          />
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="glow-card flex flex-col gap-2 p-5 sm:p-6">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-3xl font-bold leading-none tracking-tight tabular-nums sm:text-4xl">
        <CountUp value={value} className={accent ? "text-primary" : "text-foreground"} />
        {unit ? (
          <span className="ml-1.5 text-base font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {sub ? (
        <p className="font-mono text-[0.7rem] text-muted-foreground/70">{sub}</p>
      ) : (
        <p className="h-[0.85rem]" aria-hidden />
      )}
    </div>
  );
}
