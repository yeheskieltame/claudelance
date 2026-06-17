"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

export type Endpoint = {
  name: string;
  path: string;
  desc: string;
  /** HTTP method badge; defaults to GET since the public surface is read-only. */
  method?: string;
};

/**
 * One documented endpoint: a method badge, the path (which opens the live
 * response in a new tab), a one-line description, and a copy button that yields
 * the absolute URL so it pastes straight into curl or a browser.
 */
export function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  const [copied, setCopied] = React.useState(false);
  const method = endpoint.method ?? "GET";

  const copy = React.useCallback(async () => {
    const absolute =
      typeof window !== "undefined" ? new URL(endpoint.path, window.location.origin).href : endpoint.path;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / denied) - leave state unchanged.
    }
  }, [endpoint.path]);

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-4 transition hover:border-primary/50">
      <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
        {method}
      </span>
      <Link
        href={endpoint.path}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1"
      >
        <span className="flex items-center gap-1 font-mono text-sm font-semibold">
          <span className="truncate">{endpoint.name}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{endpoint.desc}</span>
      </Link>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${endpoint.name} URL copied` : `Copy ${endpoint.name} URL`}
        className={cn(
          "touch-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground",
          copied && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        )}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
