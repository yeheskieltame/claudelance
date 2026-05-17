import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import {
  HowItWorks,
  LatestOpenBounties,
  MarketStatsStrip,
  MobileStickyCta,
} from "@/components/landing-sections";
import { Footer } from "@/components/footer";
import { fetchLiveStats } from "@/lib/stats";

export default async function HomePage() {
  let snapshot: Awaited<ReturnType<typeof fetchLiveStats>> | null = null;
  let error: string | null = null;

  try {
    snapshot = await fetchLiveStats();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to read live state.";
  }

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-25 dark:opacity-20" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />
      <Hero stats={snapshot} />
      <MarketStatsStrip stats={snapshot} error={error} />
      <LatestOpenBounties />
      <HowItWorks />
      <MobileStickyCta />
      <Footer />
    </main>
  );
}
