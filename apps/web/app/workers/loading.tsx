import { Header } from "@/components/header";

/**
 * Route skeleton for the worker leaderboard. The page awaits a full on-chain
 * scan (bounty enumeration + identity + reputation multicalls) before
 * rendering, so a cold or revalidating load would otherwise show nothing.
 */
export default function WorkersLoading() {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <Header />
      <section className="mx-auto w-full max-w-3xl px-4 pb-24 pt-16 sm:pt-20">
        <div className="h-3 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-9 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-12 w-full max-w-xl animate-pulse rounded bg-muted" />

        {/* Summary stats */}
        <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse bg-card" />
          ))}
        </div>

        {/* Leaderboard rows */}
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      </section>
    </main>
  );
}
