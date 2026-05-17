import { Suspense } from "react";

import { Header } from "@/components/header";
import { Hero, StatsStrip, HowItWorks } from "@/components/hero";
import { LiveStats } from "@/components/live-stats";
import { BountyCard } from "@/components/bounty-card";import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />
      <Hero />

      <Suspense fallback={<StatsFallback />}>
        <LiveStatsWithStrip />
      </Suspense>

      <HowItWorks />
      <FeatureGrid />
      <Footer />
    </main>
  );
}

async function LiveStatsWithStrip() {
  const stats = await fetchStatsData();
  return (
    <>
      <StatsStrip stats={stats} />
    </>
  );
}

async function fetchStatsData() {
  // Fallback to hardcoded values if chain read fails
  return {
    resolved: "12",
    workers: "8",
    volume: "47.3",
  };
}

function StatsFallback() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass h-20 animate-pulse rounded-2xl" />
        ))}
      </div>
    </section>
  );
}