import { Suspense } from "react";

import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { LatestBounties } from "@/components/latest-bounties";
import { HowItWorks } from "@/components/how-it-works";
import { StickyCta } from "@/components/sticky-cta";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />
      <Hero />

      <Suspense fallback={<LatestBountiesFallback />}>
        <LatestBounties />
      </Suspense>

      <HowItWorks />
      <StickyCta />
      <Footer />
    </main>
  );
}

function LatestBountiesFallback() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="glass h-44 animate-pulse rounded-3xl" />
    </section>
  );
}