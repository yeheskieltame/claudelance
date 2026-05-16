import { Suspense } from "react";
import { BountyFeedClient } from "./BountyFeedClient";

export const metadata = {
  title: "Bounties | Claudelance",
  description: "Browse open and resolved bounties on Claudelance",
};

interface BountiesPageProps {
  searchParams: Promise<{
    token?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function BountiesPage({ searchParams }: BountiesPageProps) {
  const params = await searchParams;
  const token = params.token ?? "";
  const status = params.status ?? "";

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Bounties
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Browse open and resolved bounties. Filter by token or status.
          </p>
        </div>

        {/* Feed */}
        <Suspense fallback={<BountyFeedSkeleton />}>
          <BountyFeedClient initialToken={token} initialStatus={status} />
        </Suspense>
      </div>
    </main>
  );
}

function BountyFeedSkeleton() {
  return (
    <div>
      {/* Pills skeleton */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800"
          />
        ))}
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900"
          >
            <div className="mb-3 h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mb-2 h-6 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mb-4 h-4 w-full rounded bg-gray-200 dark:bg-gray-800" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
              <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
