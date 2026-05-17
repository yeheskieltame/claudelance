import { Suspense } from "react";

import { AuroraBackground } from "@/components/aurora-bg";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { RevenueCard } from "@/components/revenue-card";
import { TreasuryFeed } from "@/components/treasury-feed";

export const metadata = {
  title: "Treasury & Revenue — Claudelance",
  description:
    "Live on-chain revenue accrued at the Claudelance treasury. Every resolved bounty contributes a 2% protocol fee plus any forfeited stake.",
};

export default function RevenuePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <AuroraBackground />
      <Header />

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary/80">Protocol revenue</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          Treasury &amp; Revenue
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base text-muted-foreground">
          Every resolved Claudelance bounty contributes a 2% protocol fee to the
          treasury, plus any forfeited stake from non-submitting claimers. All
          revenue is on-chain at <code className="text-xs rounded bg-muted px-1.5 py-0.5">0x1362d8…E423</code>{" "}
          on Celo Mainnet — verifiable any time via Celoscan or the SDK.
        </p>

        <Suspense
          fallback={<div className="mt-10 h-44 animate-pulse rounded-2xl bg-card/50" />}
        >
          <RevenueCard />
        </Suspense>

        <Suspense
          fallback={<div className="mt-10 h-44 animate-pulse rounded-2xl bg-card/50" />}
        >
          <TreasuryFeed />
        </Suspense>
      </section>

      <Footer />
    </main>
  );
}
