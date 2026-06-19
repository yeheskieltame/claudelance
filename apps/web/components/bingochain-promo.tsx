"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";

const DISMISS_KEY = "claudelance.bingochain.ad.dismissed.v2";
// Coworking's ComingSoonAd dismissal key - kept in sync so the two cross-promo
// toasts never fight for the same screen space (both are ~19rem wide and would
// overlap on a phone-width MiniPay viewport).
const COWORKING_DISMISS_KEY = "claudelance.coworking.ad.dismissed";

/**
 * Dismissible bottom-right promo for BINGOChain - an onchain bingo game built on
 * Claudelance, staked in $LANCE. One cross-promo toast shows at a time: the
 * Coworking ComingSoonAd (bottom-left) owns the first impression, so BINGOChain
 * only surfaces once Coworking has been dismissed, or on the Coworking pages
 * where that ad hides itself. Dismissal persists in localStorage; sits above the
 * mobile bottom-nav.
 */
export function BingoChainPromo() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const coworkingAdActive =
      window.localStorage.getItem(COWORKING_DISMISS_KEY) !== "1" && !pathname.startsWith("/coworking");
    if (coworkingAdActive) return; // let Coworking go first; we take the next slot
    const timer = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [pathname]);

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
          key="bingochain-promo"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed bottom-20 right-4 z-50 w-[19rem] max-w-[calc(100vw-2rem)] md:bottom-4"
          aria-label="BINGOChain, an onchain game built on Claudelance"
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
                Built on Claudelance
              </span>

              <div className="mt-3 flex items-start gap-2.5">
                <Image
                  src="/bingochain-logo.png"
                  alt="BINGOChain"
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-xl"
                />
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">BINGOChain</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    Strategic onchain bingo on Celo. Sealed boards, verifiable winners, staked in $LANCE.
                  </p>
                </div>
              </div>

              <a
                href="https://bingochain.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-foreground"
              >
                Play BINGOChain
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
