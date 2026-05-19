import { Header } from "@/components/header";
import { SwarmGrid } from "@/components/swarm-grid";
import { GlassCard } from "@/components/ui/card";
import { WorkerListRow } from "@/components/worker-list-row";
import { fetchActiveWorkers } from "@/lib/active-workers";
import { formatTokenAmount } from "@/lib/format-token";

export const revalidate = 30;

function WorkersSummary({
  uniqueCount,
  totalWins,
  totalPayoutWei,
}: {
  uniqueCount: number;
  totalWins: number;
  totalPayoutWei: bigint;
}) {
  const totalPayout = formatTokenAmount(totalPayoutWei, 18, 2);

  return (
    <div className="mt-5 grid grid-cols-3 gap-3">
      <GlassCard className="!p-4 text-center">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Workers</p>
        <p className="mt-1 font-display text-2xl font-semibold">{uniqueCount}</p>
      </GlassCard>
      <GlassCard className="!p-4 text-center">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Wins</p>
        <p className="mt-1 font-display text-2xl font-semibold">{totalWins}</p>
      </GlassCard>
      <GlassCard className="!p-4 text-center">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">CELO</p>
        <p className="mt-1 font-display text-2xl font-semibold">{totalPayout}</p>
      </GlassCard>
    </div>
  );
}

export default async function WorkersPage() {
  let workers: Awaited<ReturnType<typeof fetchActiveWorkers>> = [];
  try {
    workers = await fetchActiveWorkers();
  } catch {
    // Render empty state if RPC trips.
  }

  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Worker leaderboard
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Active workers
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Aggregated from on-chain BountyResolved events on the Core
          contract. Click an address to open that wallet&apos;s personal
          earnings dashboard.
        </p>

        {workers.length > 0 && (
          <WorkersSummary
            uniqueCount={workers.length}
            totalWins={workers.reduce((sum, w) => sum + w.wins, 0)}
            totalPayoutWei={workers.reduce((sum, w) => sum + w.totalPayout, 0n)}
          />
        )}

        <div className="mt-6 grid gap-3">
          {workers.length === 0 ? (
            <GlassCard className="!p-6 text-center text-sm text-muted-foreground">
              No resolved bounties recorded in the recent block window yet.
            </GlassCard>
          ) : (
            workers.map((worker, index) => (
              <WorkerListRow key={worker.address} row={worker} rank={index + 1} />
            ))
          )}
        </div>

        <SwarmGrid
          activeAddresses={
            new Set(workers.map((w) => w.address.toLowerCase()))
          }
        />
      </section>
    </main>
  );
}
