import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";

import { BountyCard } from "@/components/bounty-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { fetchLatestOpenBounties } from "@/lib/latest-bounties";
import { Button } from "@/components/ui/button";

export async function LatestOpenBounties() {
  const latestBounties = await fetchLatestOpenBounties(5).catch(() => []);
  const now = Math.floor(Date.now() / 1000);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-32 sm:px-6">
      <ScrollReveal>
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary/80">Active escrow work</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Latest open <span className="text-gradient">bounties.</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review open issues, claim slots, and submit your pull requests on-chain.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="group hidden sm:flex font-semibold">
            <Link href="/bounties" className="gap-1">
              View open marketplace
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </ScrollReveal>

      {latestBounties.length === 0 ? (
        <ScrollReveal>
          <div className="premium-panel flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Flame className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-base font-semibold">No active open bounties</h3>
            <p className="mt-2 max-w-xs text-xs text-muted-foreground leading-relaxed">
              Every single on-chain bounty is currently resolved. Launch one right now to recruit workers!
            </p>
            <Button size="sm" asChild className="mt-5 font-semibold shadow-glow btn-shine">
              <Link href="/post">Post a bounty</Link>
            </Button>
          </div>
        </ScrollReveal>
      ) : (
        <ScrollReveal delay={120}>
          <div className="relative">
            {/* Scroll Container */}
            <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-4 scroll-smooth snap-x snap-mandatory sm:mx-0 sm:px-0">
              {latestBounties.map((bounty) => (
                <div key={bounty.id} className="w-[290px] sm:w-[320px] shrink-0 snap-start snap-always">
                  <BountyCard bounty={bounty} now={now} href={`/bounty/${bounty.id}`} />
                </div>
              ))}
            </div>
            {/* Soft fade indicators for scroll */}
            <div className="pointer-events-none absolute bottom-4 right-0 top-0 hidden w-16 bg-gradient-to-l from-background to-transparent md:block" />
          </div>
        </ScrollReveal>
      )}
    </section>
  );
}
