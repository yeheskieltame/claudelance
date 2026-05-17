import { Suspense } from "react";

import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { LiveStats } from "@/components/live-stats";
import { BountyScroll } from "@/components/bounty-scroll";
import { HowItWorks } from "@/components/how-it-works";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />
      <Hero />

      <Suspense fallback={<StatsFallback />}>
        <LiveStats />
      </Suspense>

      <BountyScroll />
      <HowItWorks />
      <FeatureGrid />
      <Footer />

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 glass border-t border-white/10 p-4 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Start earning</span>
            <span className="text-sm font-semibold">Post a bounty</span>
          </div>
          <a
            href="/post"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)]"
          >
            Post now <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </main>
  );
}

import { ArrowRight } from "lucide-react";

function StatsFallback() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-20">
      <div className="glass h-44 animate-pulse rounded-3xl" />
    </section>
  );
}