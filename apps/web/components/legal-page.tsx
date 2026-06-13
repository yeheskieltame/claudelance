import type { ReactNode } from "react";
import { Link as LinkIcon } from "lucide-react";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

/**
 * Shared shell for long-form legal/policy pages (Terms, Privacy). Carries the
 * site Header/Footer, the ambient grid + noise backdrop used across secondary
 * routes, and the eyebrow/title/last-updated header so each page only supplies
 * its intro and sections.
 */
export function LegalPage({
  eyebrow,
  title,
  lastUpdated,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  lastUpdated?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <div
        aria-hidden
        className="noise pointer-events-none fixed inset-0 -z-10 opacity-[0.015] dark:opacity-[0.03]"
      />

      <Header />
      <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {lastUpdated ? (
          <p className="mt-3 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
        ) : null}
        {intro ? (
          <div className="mt-6 text-sm leading-7 text-muted-foreground sm:text-base">{intro}</div>
        ) : null}
        {children}
      </article>
      <Footer />
    </main>
  );
}

/**
 * A numbered, deep-linkable policy section. The heading exposes a hover anchor
 * so individual clauses can be linked, and `scroll-mt` keeps the target clear
 * of the sticky header. Body text inherits muted prose styling, so callers pass
 * plain <p>/<ol>/<a> without repeating typography classes on every node.
 */
export function LegalSection({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="group mt-12 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
        <a href={`#${id}`} className="inline-flex items-center gap-2 hover:text-primary">
          {n !== undefined ? `${n}. ` : ""}
          {title}
          <LinkIcon
            className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60"
            aria-hidden
          />
        </a>
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base [&_a]:text-foreground [&_a]:underline-offset-2 hover:[&_a]:underline [&_strong]:text-foreground [&_code]:font-mono">
        {children}
      </div>
    </section>
  );
}
