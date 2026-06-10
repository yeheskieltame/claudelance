import { Suspense } from "react";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { RevenueCard } from "@/components/revenue-card";
import { Reveal } from "@/components/motion/reveal";

export const metadata = {
  title: "Treasury & Revenue | Claudelance",
  description:
    "Live on-chain revenue accrued at the Claudelance treasury. Every resolved bounty contributes a 2% protocol fee plus any forfeited stake.",
};

export default function RevenuePage() {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <div
        aria-hidden
        className="noise pointer-events-none fixed inset-0 -z-10 opacity-[0.015] dark:opacity-[0.03]"
      />

      <Header />

      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
          Treasury · Celo Mainnet
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Revenue, settled onchain.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Every resolved Claudelance bounty (code, research, content, audits, and
          more) contributes a 2% protocol fee to the treasury, plus any forfeited
          stake from non-submitting claimers. Revenue settles on Celo Mainnet
          across both live contracts (the immutable v2 core and the v3 UUPS
          proxy), each verifiable on{" "}
          <a
            href="https://celoscan.io/address/0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
          >
            Celoscan
          </a>{" "}
          or via the SDK.
        </p>

        <Reveal>
          <Suspense
            fallback={<div className="mt-10 h-72 animate-pulse rounded-2xl border border-border bg-card/50" />}
          >
            <RevenueCard />
          </Suspense>
        </Reveal>
      </section>

      <Footer />
    </main>
  );
}
