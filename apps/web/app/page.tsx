import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { Hero } from "@/components/hero";
import { LiveStats } from "@/components/live-stats";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <AppShell>
      <Hero />

      <Suspense fallback={<StatsFallback />}>
        <LiveStats />
      </Suspense>

      <FeatureGrid />
      <Footer />
    </AppShell>
  );
}

function StatsFallback() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-20">
      <div className="glass h-44 animate-pulse rounded-3xl" />
    </section>
  );
}
