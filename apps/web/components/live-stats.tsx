import { ArrowUpRight, Coins, Hammer, Sparkles, Users } from "lucide-react";

import { AnimatedCounter } from "@/components/animated-counter";
import { ScrollReveal } from "@/components/scroll-reveal";
import { fetchLiveStats, type LiveStats as LiveStatsType } from "@/lib/stats";
import { getDeployment } from "@/lib/contracts";
import { DEFAULT_CHAIN_ID, chainById } from "@/lib/chain";

export const revalidate = 60;

export async function LiveStats({ stats: passedStats }: { stats?: LiveStatsType | null }) {
  let snapshot: LiveStatsType | null = passedStats ?? null;
  let error: string | null = null;

  if (!snapshot) {
    try {
      snapshot = await fetchLiveStats();
    } catch (e) {
      error = e instanceof Error ? e.message : "Unable to read live state.";
    }
  }

  const deployment = getDeployment(DEFAULT_CHAIN_ID);
  const chain = chainById(DEFAULT_CHAIN_ID);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-32 sm:px-6">
      <ScrollReveal>
        <div className="mb-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary/80">Protocol metrics</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Receipts, not promises.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Every number below reads directly from the smart contract on Celo Mainnet.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <div className="premium-panel glow-ring relative overflow-hidden rounded-2xl">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <img
                src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/assets/0x471EcE3750Da237f93B8E339c536989b8978a438/logo.png"
                alt="CELO"
                width={16}
                height={16}
                className="rounded-full object-cover"
              />
              <span className="text-sm font-medium">Live protocol on {chain?.name}</span>
            </div>
            <a
              href={`${chain?.blockExplorers?.default.url}/address/${deployment.core}#code`}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              Verified contract
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* Gradient divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 via-amber-500/20 to-transparent blur-[0.5px]" />

          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : snapshot ? (
            <div className="grid grid-cols-1 sm:grid-cols-3">
              <StatCell
                icon={<Sparkles className="h-5 w-5" />}
                label="Bounties Resolved"
                value={Number(snapshot.totalResolved)}
                sub="Fully settled on-chain"
                color="text-amber-500"
              />
              <StatCell
                icon={<Users className="h-5 w-5" />}
                label="Unique Workers"
                value={Number(snapshot.uniqueWorkers)}
                sub={`${snapshot.uniquePosters} posters onboarded`}
                color="text-slate-500"
              />
              <StatCell
                icon={<Coins className="h-5 w-5" />}
                label="Total Volume"
                value={snapshot.totalVolumeUsd}
                prefix="$"
                decimals={2}
                sub="cUSD + CELO + USDC escrowed"
                color="text-blue-500"
              />
            </div>
          ) : null}
        </div>
      </ScrollReveal>
    </section>
  );
}

function StatCell({ icon, label, value, prefix, decimals, sub, color }: {
  icon: React.ReactNode; label: string; value: number; prefix?: string; decimals?: number; sub?: string; color: string;
}) {
  return (
    <div className="group border-t sm:border-t-0 sm:border-l border-border/70 p-6 transition-colors first:border-t-0 first:border-l-0 hover:bg-foreground/[0.02]">
      <div className={color}>{icon}</div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">
        <AnimatedCounter value={value} prefix={prefix} decimals={decimals} duration={2000} />
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground/80">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
