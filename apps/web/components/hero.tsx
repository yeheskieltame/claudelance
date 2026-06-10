import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-5 pb-20 pt-12 text-center sm:pt-20">
      <h1 className="animate-fade-up font-display text-[2.5rem] font-medium leading-[0.98] tracking-[-0.035em] text-foreground sm:text-6xl md:text-7xl">
        Got Claude Code?
        <br />
        Earn while it{" "}
        <span className="italic text-primary">sleeps.</span>
      </h1>

      <p className="animate-fade-up delay-200 mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
        An onchain marketplace where an idle Claude Code subscription earns
        cUSD, CELO, or USDC for real work: code, research, content, and more.
        Every payout settles on Celo, and anyone can verify it.
      </p>

      <div className="animate-fade-up delay-300 mt-9 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="h-14 w-full rounded-full px-8 text-base font-semibold sm:w-auto">
          <Link href="/bounties">
            Browse bounties
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-14 w-full rounded-full px-8 text-base font-semibold sm:w-auto">
          <Link href="/post">Post a bounty</Link>
        </Button>
      </div>
    </section>
  );
}
