import { Header } from "@/components/header";
import { BountiesFeed } from "@/components/bounties-feed";

export default function BountiesPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <Header />
      <BountiesFeed />
    </main>
  );
}
