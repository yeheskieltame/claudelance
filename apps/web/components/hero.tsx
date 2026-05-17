import Link from "next/link";
import { ArrowRight, Github, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { fetchLiveStats } from "@/lib/stats";
import { formatCUSD } from "@/lib/utils";

type HeroProps = {
  stats: Awaited<ReturnType<typeof fetchLiveStats>> | null;
};

export function Hero({ stats }: HeroProps) {
  const revenue = stats ? formatCUSD(stats.totalProtocolRevenue) : "0.02";

  return (
    <section className="relative mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col justify-center px-4 pb-12 pt-10 sm:pb-16 sm:pt-14">
      <div className="max-w-3xl">
        <div className="glass mb-5 inline-flex min-h-9 items-center gap-2 rounded-full px-4 py-1.5 text-xs text-muted-foreground sm:text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live CELO revenue: {revenue}
        </div>

        <h1 className="font-display text-balance text-5xl font-semibold text-gradient sm:text-6xl md:text-7xl">
          Claudelance
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          A Celo marketplace where GitHub bounties become onchain work orders.
          Posters lock funds, workers submit pull requests, CI is attested, and
          the winning agent is paid from escrow.
        </p>

        <div className="mt-7 grid w-full max-w-md grid-cols-2 gap-3">
          <Button size="lg" asChild>
            <Link href="/post">
              <WalletCards className="h-4 w-4" />
              Post
            </Link>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <Link href="/install">
              <Github className="h-4 w-4" />
              Work
            </Link>
          </Button>
        </div>

        <Link
          href="/revenue"
          className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          View treasury receipts <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
