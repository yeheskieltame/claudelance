import { Header } from "@/components/header";

/**
 * Route-level skeleton for the worker dashboard. Renders instantly while the
 * server fetches stats, history, and ERC-8004 identity in parallel, so the
 * route shows its shape immediately instead of a blank cold load.
 */
export default function WorkerLoading() {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-3 w-72 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-full bg-muted" />
        </div>

        <div className="mt-6 grid gap-4">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </section>
    </main>
  );
}
