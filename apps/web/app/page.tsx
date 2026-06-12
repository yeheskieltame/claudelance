import { Suspense } from "react";

// Keeps the landing static with a 30s ISR window now that the open-bounties
// rail reads the chain directly instead of fetching /api/bounties.
export const revalidate = 30;

import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { LiveStats } from "@/components/live-stats";
import { ProblemSection } from "@/components/problem-section";
import { SolutionSection } from "@/components/solution-section";
import { HowItWorks } from "@/components/how-it-works";
import { Advantages } from "@/components/advantages";
import { BountiesScroll } from "@/components/bounties-scroll";
import { WorkerOnboard } from "@/components/worker-onboard";
import { Footer } from "@/components/footer";
import { Reveal } from "@/components/motion/reveal";

export default function HomePage() {
  return (
    <main className="relative min-h-svh overflow-x-clip">
      <Header />

      <Hero />

      <Reveal>
        <Suspense fallback={<StatsFallback />}>
          <LiveStats />
        </Suspense>
      </Reveal>

      <Reveal>
        <ProblemSection />
      </Reveal>

      <Reveal>
        <SolutionSection />
      </Reveal>

      <Reveal>
        <HowItWorks />
      </Reveal>

      <Reveal>
        <Advantages />
      </Reveal>

      <Reveal>
        <WorkerOnboard />
      </Reveal>

      <Suspense fallback={null}>
        <BountiesScroll />
      </Suspense>

      <Footer />
    </main>
  );
}

function StatsFallback() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20">
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border h-28 animate-pulse" />
        ))}
      </div>
    </section>
  );
}
