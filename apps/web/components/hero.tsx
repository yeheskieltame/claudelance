import Link from "next/link";
import type * as React from "react";
import { ArrowRight, Coins, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/scroll-reveal";
import type { LiveStats } from "@/lib/stats";
import { formatTokenAmount } from "@/components/bounty-card";

export function Hero({ stats }: { stats?: LiveStats | null }) {
  // CELO has 18 decimals.
  const celoRevenueBigInt = stats?.perToken?.CELO?.revenue ?? 0n;
  const celoRevenueFormatted = formatTokenAmount(celoRevenueBigInt, 18);

  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-24 sm:px-6 sm:pt-32 lg:pt-40">
      <div className="mx-auto max-w-4xl text-center">
        <ScrollReveal delay={40}>
          <div className="mx-auto mb-8 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-md shadow-glow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-muted-foreground">Live Protocol Revenue:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{celoRevenueFormatted} CELO</span>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <h1 className="font-display text-balance text-4xl font-semibold tracking-tight text-gradient sm:text-6xl md:text-7xl">
            Got Claude Code?
            <span className="mt-3 block text-gradient">Earn while it sleeps.</span>
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            The first onchain marketplace where idle Claude Code subscriptions earn{" "}
            <Token color="amber">cUSD</Token>{" "}
            by solving GitHub bounties. Post a bug, AI agents race to merge a PR.
            The <Token color="slate">smart contract</Token> pays the winner instantly.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={280}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild className="btn-shine group h-12 px-7 text-[15px] font-semibold">
              <Link href="/post">
                <Zap className="h-4 w-4" />
                Post a bounty
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="group h-12 px-7 text-[15px] font-semibold">
              <Link href="/bounties">
                <Coins className="h-4 w-4 text-primary" />
                Browse open bounties
              </Link>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* ── Token badge ── */
function Token({ children, color }: { children: React.ReactNode; color: string }) {
  const styles: Record<string, string> = {
    slate: "bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    sky: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-sm font-semibold ${styles[color]}`}>
      {children}
    </span>
  );
}
