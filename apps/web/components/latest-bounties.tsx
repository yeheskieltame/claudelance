"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BountyCard, type BountyCardProps } from "@/components/bounty-card";

const MOCK_BOUNTIES: BountyCardProps["bounty"][] = [
  {
    id: 1n, poster: "0x0", token: "0x0" as `0x${string}`, amount: 1000000000000000000n,
    maxSlots: 3, deadline: BigInt(Date.now() + 86400000), resolved: false,
    metadata: JSON.stringify({ title: "Build DeFi Dashboard Widget", description: "Create a real-time DeFi portfolio widget" }),
    bountyType: 0, ciRequired: false, createdAt: BigInt(Date.now()),
    slotCount: 1, winningWorker: "0x0" as `0x${string}`
  },
  {
    id: 2n, poster: "0x0", token: "0x0" as `0x${string}`, amount: 5000000000000000000n,
    maxSlots: 5, deadline: BigInt(Date.now() + 172800000), resolved: false,
    metadata: JSON.stringify({ title: "Smart Contract Audit Tool", description: "Automated security scanner for Solidity" }),
    bountyType: 0, ciRequired: true, createdAt: BigInt(Date.now() - 3600000),
    slotCount: 2, winningWorker: "0x0" as `0x${string}`
  },
  {
    id: 3n, poster: "0x0", token: "0x0" as `0x${string}`, amount: 2000000000000000000n,
    maxSlots: 2, deadline: BigInt(Date.now() + 259200000), resolved: false,
    metadata: JSON.stringify({ title: "NFT Marketplace API", description: "RESTful API for NFT trading platform" }),
    bountyType: 0, ciRequired: false, createdAt: BigInt(Date.now() - 7200000),
    slotCount: 0, winningWorker: "0x0" as `0x${string}`
  },
  {
    id: 4n, poster: "0x0", token: "0x0" as `0x${string}`, amount: 750000000000000000n,
    maxSlots: 4, deadline: BigInt(Date.now() + 432000000), resolved: false,
    metadata: JSON.stringify({ title: "Cross-Chain Bridge UI", description: "Frontend for cross-chain token bridge" }),
    bountyType: 0, ciRequired: false, createdAt: BigInt(Date.now() - 14400000),
    slotCount: 3, winningWorker: "0x0" as `0x${string}`
  },
  {
    id: 5n, poster: "0x0", token: "0x0" as `0x${string}`, amount: 3000000000000000000n,
    maxSlots: 3, deadline: BigInt(Date.now() + 604800000), resolved: false,
    metadata: JSON.stringify({ title: "ZK-Rollup Explorer", description: "Block explorer for ZK-rollup transactions" }),
    bountyType: 0, ciRequired: true, createdAt: BigInt(Date.now() - 28800000),
    slotCount: 1, winningWorker: "0x0" as `0x${string}`
  },
];

export function LatestBounties() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = 320;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="relative w-full py-8 md:py-12">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <div>
            <h2 className="text-lg font-semibold md:text-xl lg:text-2xl">
              Latest Bounties
            </h2>
            <p className="mt-1 text-xs text-muted md:text-sm">
              Fresh opportunities from the onchain marketplace
            </p>
          </div>
          <div className="hidden gap-1 md:flex">
            <button
              onClick={() => scroll("left")}
              className="rounded-full border border-border p-1.5 hover:bg-muted/50 transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="rounded-full border border-border p-1.5 hover:bg-muted/50 transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 scrollbar-hide md:gap-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {MOCK_BOUNTIES.map((bounty) => (
            <div
              key={bounty.id.toString()}
              className="w-[280px] flex-shrink-0 snap-start sm:w-[300px] md:w-[340px]"
            >
              <BountyCard
                bounty={bounty}
                href={`/bounties/${bounty.id.toString()}`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
