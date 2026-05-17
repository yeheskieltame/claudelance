import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { BountyCard } from "@/components/bounty-card";

export const revalidate = 30;

type ApiBounty = {
  id: string;
  poster: string;
  amount: string;
  winner: string;
  stakeRequired: string;
  token: string;
  deadline: string;
  maxSlots: number;
  claimedSlots: number;
  bountyType: number;
  ciRequired: boolean;
  targetWorker: string;
  status: number;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash: string;
};

async function getOpenBounties(): Promise<ApiBounty[]> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/bounties?status=open&limit=5`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.bounties) ? data.bounties : [];
  } catch {
    return [];
  }
}

export async function LatestBounties() {
  const bounties = await getOpenBounties();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Latest open bounties
        </h2>
        <Link
          href="/bounties"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <GlassCard className="!p-0">
        {bounties.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No open bounties yet.{" "}
            <Link href="/post" className="text-primary hover:underline">
              Post the first one
            </Link>
          </p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 px-6 pt-6">
            {bounties.map((bounty) => (
              <div key={bounty.id} className="shrink-0 w-72">
                <BountyCard bounty={bounty as any} href={`/bounty/${bounty.id}`} />
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </section>
  );
}