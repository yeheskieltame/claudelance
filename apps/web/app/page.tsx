import { Suspense } from "react";
import HeroSection from "@/components/landing/HeroSection";
import StatsStrip from "@/components/landing/StatsStrip";
import LatestBounties from "@/components/landing/LatestBounties";
import HowItWorks from "@/components/landing/HowItWorks";
import Footer from "@/components/landing/Footer";

export const revalidate = 60; // ISR every 60 seconds

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsStrip />
      </Suspense>
      <Suspense fallback={<BountiesSkeleton />}>
        <LatestBounties />
      </Suspense>
      <HowItWorks />
      <Footer />
    </main>
  );
}

function HeroSkeleton() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-950 animate-pulse">
      <div className="w-full max-w-4xl px-4 space-y-6">
        <div className="h-12 bg-gray-800 rounded-lg w-3/4 mx-auto" />
        <div className="h-8 bg-gray-800 rounded-lg w-1/2 mx-auto" />
        <div className="h-16 bg-gray-800 rounded-xl w-48 mx-auto" />
        <div className="flex gap-4 justify-center">
          <div className="h-12 bg-gray-800 rounded-full w-36" />
          <div className="h-12 bg-gray-800 rounded-full w-36" />
        </div>
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="py-12 px-4 grid grid-cols-3 gap-4 max-w-4xl mx-auto animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 bg-gray-800 rounded-2xl" />
      ))}
    </div>
  );
}

function BountiesSkeleton() {
  return (
    <div className="py-12 px-4 animate-pulse">
      <div className="h-8 bg-gray-800 rounded w-48 mb-6 mx-4" />
      <div className="flex gap-4 overflow-hidden px-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-72 h-48 bg-gray-800 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
