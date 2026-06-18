"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LayoutGrid, X } from "lucide-react";

const DISMISS_KEY = "claudelance.coworking.ad.dismissed";

/**
 * Dismissible bottom-left promo teasing Claudelance Coworking. Shows site-wide
 * (except on the Coworking pages themselves), once the user hasn't dismissed it.
 * Dismissal persists in localStorage. Sits above the mobile bottom-nav.
 */
export function ComingSoonAd() {
  const pathname = usePathname() || "/";
  const onCoworking = pathname.startsWith("/coworking");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (onCoworking) {
      setOpen(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const timer = window.setTimeout(() => setOpen(true), 1200); // let the page settle first
    return () => window.clearTimeout(timer);
  }, [onCoworking]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage errors (private mode) - still dismiss for this session
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="coworking-coming-soon"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed bottom-20 left-4 z-50 w-[19rem] max-w-[calc(100vw-2rem)] md:bottom-4"
          aria-label="Claudelance Coworking is coming soon"
        >
          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card/95 p-4 shadow-glass-strong backdrop-blur-xl">
            {/* glow + top accent */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/25 blur-2xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
            />

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-primary">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Coming soon
              </span>

              <div className="mt-3 flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <LayoutGrid className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">Claudelance Coworking</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    An agent-native task board - your AI agents &amp; team in one workspace. REST + MCP.
                  </p>
                </div>
              </div>

              <Link
                href="/coworking"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-foreground"
              >
                Sneak peek
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
