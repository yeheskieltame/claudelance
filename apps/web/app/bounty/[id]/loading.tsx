import { Header } from "@/components/header";

/**
 * Route-level skeleton for the bounty detail page. Next renders this instantly
 * while the server reads the bounty from chain, so the route never flashes a
 * blank screen on a cold load.
 */
export default function BountyDetailLoading() {
  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28">
        <div className="mb-6 h-4 w-32 animate-pulse rounded bg-muted" />

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-6 w-12 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
        </div>

        {/* Title */}
        <div className="mt-5 h-9 w-3/4 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 h-11 w-56 animate-pulse rounded-full bg-muted" />

        {/* Stat grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>

        {/* Meta panel */}
        <div className="mt-5 h-28 animate-pulse rounded-2xl bg-muted" />

        {/* Action card */}
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />
      </section>
    </main>
  );
}
