import { ArrowUpRight, Coins, Hammer, ScanLine, Users } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { fetchLiveStats } from "@/lib/stats";
import { formatCELO } from "@/lib/utils";
import { getDeployment } from "@/lib/contracts";
import { DEFAULT_CHAIN_ID, chainById } from "@/lib/chain";

export const revalidate = 60;

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
    <section className="mx-auto w-full max-w-5xl px-4 pb-20">
      <GlassCard className="!p-0">
        <header className="flex flex-col gap-1 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Marketplace pulse · {chain?.name}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Receipts, not promises.
            </h2>
          </div>
          <a
            href={`${chain?.blockExplorers?.default.url}/address/${deployment.core}#code`}
            target="_blank"
            rel="noreferrer"
            className="touch-target inline-flex items-center gap-1 rounded-full text-sm text-muted-foreground hover:text-foreground"
          >
            View verified contract <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </header>

        {error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : snapshot ? (
          <ul className="grid grid-cols-2 divide-y divide-white/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <Stat
              icon={<Hammer className="h-4 w-4" />}
              label="Bounties posted"
              value={snapshot.bountyCount.toString()}
            />
            <Stat
              icon={<Coins className="h-4 w-4" />}
              label="Total volume"
              value={`${formatCELO(snapshot.totalVolumeInCelo)} CELO`}
              sub={`CELO ≈ $${snapshot.celoUsdPrice.toFixed(2)}`}
            />
            <Stat
              icon={<ScanLine className="h-4 w-4" />}
              label="Resolved"
              value={snapshot.totalBountiesResolved.toString()}
              sub={`${(Number(snapshot.feeBps) / 100).toFixed(2)}% fee`}
            />
            <Stat
              icon={<Users className="h-4 w-4" />}
              label="Unique workers"
              value={snapshot.uniqueWorkerCount.toString()}
              sub={`${snapshot.uniquePosterCount} posters`}
            />
          </ul>
        ) : null}
      </GlassCard>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <li className="flex flex-col gap-1 p-6">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
        {icon}
      </span>
      <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </li>
  );
}
