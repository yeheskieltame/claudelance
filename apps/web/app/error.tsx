"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * App-level error boundary. Next renders this when a route segment throws on
 * the client (e.g. an RPC read blows up). `reset()` retries the segment without
 * a full reload.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-x-clip px-4 text-center">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
        Something broke
      </p>
      <h1 className="mt-2 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
        This page hit an error.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        A read may have failed or an RPC may be briefly unavailable. Try again, your funds and
        on-chain state are unaffected.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground/70">ref: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={reset} className="rounded-full">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden />
            Home
          </Link>
        </Button>
      </div>
    </main>
  );
}
