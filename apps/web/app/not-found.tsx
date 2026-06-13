import Link from "next/link";
import { Compass, Home, Target } from "lucide-react";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <Header />
      <section className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-24 pt-28 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
          404 · Off the map
        </p>
        <h1 className="mt-2 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
          This page isn&apos;t on-chain.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          The link may be broken or the bounty may have moved. Everything real lives on the
          marketplace, head back and pick up the trail.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-full">
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden />
              Home
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/bounties">
              <Target className="h-4 w-4" aria-hidden />
              Browse bounties
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
