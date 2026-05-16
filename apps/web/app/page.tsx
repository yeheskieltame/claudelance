import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { OpenBountyRail } from "@/components/open-bounty-rail";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden pb-24 md:pb-0">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />
      <Hero />
      <OpenBountyRail />
      <FeatureGrid />
      <Footer />

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <div className="glass-strong grid grid-cols-2 gap-2 rounded-3xl p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <Button asChild size="sm">
            <Link href="/post">Post bounty</Link>
          </Button>
          <Button asChild size="sm" variant="glass">
            <Link href="/install">Work one</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
