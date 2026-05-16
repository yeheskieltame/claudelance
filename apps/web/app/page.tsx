import { Suspense } from "react";

import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { LiveStats } from "@/components/live-stats";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main className="mobile-shell safe-area-bottom relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />
      <Hero />

      <Suspense fallback={<StatsFallback />}>
        <LiveStats />
      </Suspense>

      <FeatureGrid />
      <Footer />
    </main>
  );
}

function StatsFallback() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-20">
      <div className="glass h-44 animate-pulse rounded-3xl" />
    </section>
  );
}
