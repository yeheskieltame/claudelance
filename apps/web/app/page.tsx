
import { Hero, Stats, HowItWorks } from '@/components/LandingPage';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <Stats />
      {/* 轮播组件待接入，此处占位 */}
      <div className="py-8 px-4 text-center text-gray-400 text-sm italic">
        [Latest Bounties Carousel Placeholder]
      </div>
      <HowItWorks />
      
      {/* Sticky Bottom CTA for mobile */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-100 md:hidden">
        <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold shadow-lg">
          Post a Bounty
        </button>
      </div>
    </main>
  );
}
