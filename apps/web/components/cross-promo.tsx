"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, LayoutGrid, Sprout, X, type LucideIcon } from "lucide-react";

// One dismissible card that rotates through the sibling products in the
// ecosystem. Replaces the two single-product toasts (Coworking + BINGOChain)
// that used to fight for screen space. Bump the version to re-show after a
// redesign. Claudelance itself is omitted (you're already here); Coworking
// drops out of the rotation on its own pages.
const DISMISS_KEY = "claudelance.crosspromo.dismissed.v1";
const ROTATE_MS = 5000;

type Product = {
  key: string;
  href: string;
  external: boolean;
  logo?: string;
  icon?: LucideIcon;
  eyebrow: string;
  title: string;
  blurb: string;
  cta: string;
};

const PRODUCTS: Product[] = [
  {
    key: "coworking",
    href: "/coworking",
    external: false,
    icon: LayoutGrid,
    eyebrow: "Coming soon",
    title: "Claudelance Coworking",
    blurb: "Agent-native task board: your AI agents and team in one workspace. REST + MCP.",
    cta: "Sneak peek",
  },
  {
    key: "bingochain",
    href: "https://bingochain.vercel.app",
    external: true,
    logo: "/bingochain-logo.png",
    eyebrow: "Built on Claudelance",
    title: "BINGOChain",
    blurb: "Strategic onchain bingo on Celo. Sealed boards, verifiable winners, staked in $LANCE.",
    cta: "Play BINGOChain",
  },
  {
    key: "ownafarm",
    href: "https://ownafarm.xyz",
    external: true,
    icon: Sprout,
    eyebrow: "Partner project",
    title: "OwnaFarm",
    blurb: "Plant seeds, fund real farms, harvest yields. Real-world-asset GameFi on Mantle.",
    cta: "Explore OwnaFarm",
  },
];

export function CrossPromo() {
  const pathname = usePathname() || "/";
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  // Don't advertise the page you're already standing on.
  const products = React.useMemo(
    () => PRODUCTS.filter((p) => !(p.key === "coworking" && pathname.startsWith("/coworking"))),
    [pathname],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const t = window.setTimeout(() => setOpen(true), 1200); // let the page settle first
    return () => window.clearTimeout(t);
  }, []);

  // Auto-rotate, paused on hover/focus and for reduced-motion users (who drive
  // it with the dots instead). ponytail: setInterval, no carousel lib.
  React.useEffect(() => {
    if (!open || paused || reduce || products.length < 2) return;
    const t = window.setInterval(() => setIndex((n) => (n + 1) % products.length), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [open, paused, reduce, products.length]);

  React.useEffect(() => {
    if (index >= products.length) setIndex(0); // list shrank (navigated onto /coworking)
  }, [index, products.length]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage errors (private mode) - still dismiss for this session
    }
    setOpen(false);
  };

  const p = products[index] ?? products[0];
  if (!p) return null;
  const Icon = p.icon;

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="cross-promo"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="fixed bottom-20 left-4 z-50 w-[20rem] max-w-[calc(100vw-2rem)] md:bottom-4"
          aria-label="More from the Claudelance ecosystem"
        >
          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card/95 p-4 shadow-glass-strong backdrop-blur-xl">
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
              className="absolute right-2.5 top-2.5 z-10 inline-flex size-9 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={p.key}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="relative pr-9"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-primary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {p.eyebrow}
                </span>

                <div className="mt-3 flex items-start gap-2.5">
                  {p.logo ? (
                    <Image
                      src={p.logo}
                      alt={p.title}
                      width={36}
                      height={36}
                      className="h-9 w-9 shrink-0 rounded-xl"
                    />
                  ) : Icon ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold leading-tight">{p.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{p.blurb}</p>
                  </div>
                </div>

                {p.external ? (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-foreground"
                  >
                    {p.cta}
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                ) : (
                  <Link
                    href={p.href}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-foreground"
                  >
                    {p.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>

            {products.length > 1 ? (
              <div className="mt-3 flex items-center gap-1.5">
                {products.map((prod, idx) => (
                  <button
                    key={prod.key}
                    type="button"
                    onClick={() => setIndex(idx)}
                    aria-label={`Show ${prod.title}`}
                    aria-current={idx === index}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === index ? "w-5 bg-primary" : "w-1.5 bg-primary/30 hover:bg-primary/50"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
