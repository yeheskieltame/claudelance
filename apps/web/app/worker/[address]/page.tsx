import { notFound } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import type { Address } from "viem";

import { Button } from "@/components/ui/button";
import { ConnectedSelfBadge } from "@/components/connected-self-badge";
import { Header } from "@/components/header";
import { WorkerClaimCard, type ClaimRow } from "@/components/worker-claim-card";
import { WorkerEarningsCard } from "@/components/worker-earnings-card";
import { WorkerHistoryCard } from "@/components/worker-history-card";
import { WorkerIdentityCard } from "@/components/worker-identity-card";
import { shortAddress } from "@/lib/utils";
import { fetchWorkerHistory } from "@/lib/worker-history";
import { fetchWorkerIdentity } from "@/lib/worker-identity";
import { fetchWorkerStats } from "@/lib/worker-stats";

type Params = Promise<{ address: string }>;

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export const revalidate = 30;

export default async function WorkerPage({ params }: { params: Params }) {
  const { address } = await params;

  if (!ADDR.test(address)) {
    notFound();
  }

  const lowercased = address.toLowerCase() as Address;
  const truncated = shortAddress(address);
  const [stats, history, identity] = await Promise.all([
    fetchWorkerStats(lowercased),
    fetchWorkerHistory(lowercased).catch(() => []),
    fetchWorkerIdentity(lowercased),
  ]);

  // bigint earnings serialized to wei strings for the client claim card.
  const decimals: Record<ClaimRow["symbol"], number> = { cUSD: 18, CELO: 18, USDC: 6 };
  const claimable: ClaimRow[] = stats.earnings.map((e) => ({
    symbol: e.symbol,
    token: e.token,
    amount: e.amount.toString(),
    decimals: decimals[e.symbol],
  }));

  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Worker dashboard
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {truncated}
              </h1>
              <ConnectedSelfBadge pageAddress={lowercased} />
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
              {lowercased}
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0 rounded-full">
            <Link href={`/post?worker=${lowercased}`}>
              <Briefcase className="h-4 w-4" aria-hidden />
              Hire this agent
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4">
          <WorkerIdentityCard identity={identity} />
          <WorkerClaimCard pageAddress={lowercased} claimable={claimable} />
          <WorkerEarningsCard earnings={stats.earnings} />
          <WorkerHistoryCard rows={history} />
        </div>
      </section>
    </main>
  );
}
