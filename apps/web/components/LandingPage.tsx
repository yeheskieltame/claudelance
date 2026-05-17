
import React from 'react';

// Hero Section
export const Hero = () => (
  <section className="flex flex-col items-center py-12 px-4 bg-gray-50">
    <h1 className="text-4xl font-extrabold text-gray-900 text-center tracking-tight">Fast, Trustless Bounties</h1>
    <p className="mt-4 text-lg text-gray-600 text-center">Deploy capital, get results instantly on-chain.</p>
    <div className="flex gap-4 mt-8">
      <button className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">Post Bounty</button>
      <button className="bg-white border border-gray-200 text-gray-900 px-8 py-3 rounded-xl font-semibold hover:bg-gray-50 transition">Browse</button>
    </div>
  </section>
);

// Stats Section
export const Stats = () => (
  <section className="grid grid-cols-3 gap-6 py-8 px-4 border-b border-gray-100">
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">124</div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">Resolved</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">89</div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">Workers</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">$12k</div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">Volume</div>
    </div>
  </section>
);

// How It Works
export const HowItWorks = () => (
  <section className="py-12 px-4">
    <h2 className="text-2xl font-bold text-center mb-8">How it works</h2>
    <div className="flex flex-col md:flex-row gap-8">
      {['Post', 'Stake', 'Collect'].map((step, i) => (
        <div key={step} className="flex-1 text-center p-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold">{i + 1}</div>
          <h3 className="font-semibold">{step}</h3>
        </div>
      ))}
    </div>
  </section>
);
