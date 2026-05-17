"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Rss,
  SquarePen,
  DollarSign,
  BookOpen,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Image from "next/image";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { WalletButton } from "@/components/wallet-button";

const links = [
  { label: "Bounties", href: "/bounties" },
  { label: "Post", href: "/post" },
  { label: "Revenue", href: "/revenue" },
  { label: "Docs", href: "https://github.com/yeheskieltame/claudelance#contributing", ext: true },
];

export function Header() {
  const path = usePathname() || "/";
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      suppressHydrationWarning
      className={cn(
        "transparent sticky top-0 z-50 w-full transition-all duration-500",
        scrolled
          ? "bg-background/[0.78] backdrop-blur-2xl shadow-[0_1px_0_hsl(var(--border)/0.68)]"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-8 w-8 overflow-hidden rounded-xl border border-foreground/10 bg-foreground shadow-sm transition-transform duration-300 group-hover:scale-[1.04] dark:border-white/10">
            <Image
              src="/logo.webp"
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="text-[15px] font-bold tracking-tight">Claudelance</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => {
            const active = !l.ext && (l.href === "/" ? path === "/" : path.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                target={l.ext ? "_blank" : undefined}
                rel={l.ext ? "noreferrer" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <div className="hidden sm:inline-flex">
            <WalletButton />
          </div>

          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu - Premium slide down drawer with glassmorphic styling */}
      <div
        className={cn(
          "absolute left-0 right-0 top-[65px] z-40 border-b border-border bg-background/95 p-6 shadow-2xl backdrop-blur-3xl transition-all duration-300 ease-out md:hidden",
          open
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "-translate-y-4 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Navigation Menu
          </p>
          <div className="grid grid-cols-1 gap-2">
            {links.map((l) => {
              const active = !l.ext && (l.href === "/" ? path === "/" : path.startsWith(l.href));
              
              // Resolve icon dynamically
              let Icon = Rss;
              if (l.label === "Post") Icon = SquarePen;
              if (l.label === "Revenue") Icon = DollarSign;
              if (l.label === "Docs") Icon = BookOpen;

              return (
                <Link
                  key={l.href}
                  href={l.href}
                  target={l.ext ? "_blank" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border p-3.5 text-xs font-semibold transition-all duration-300",
                    active
                      ? "border-primary/20 bg-primary/5 text-primary shadow-sm"
                      : "border-border/50 bg-card/25 hover:border-primary/30 hover:bg-card/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span>{l.label}</span>
                    {l.ext && <span className="text-[9px] font-normal text-muted-foreground/60">External Resource</span>}
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>

          {/* Wallet Section */}
          <div className="mt-2 border-t border-border/60 pt-4 flex flex-col gap-3">
            <div className="w-full flex justify-center">
              <WalletButton className="w-full justify-center py-5 rounded-xl text-xs font-semibold shadow-glow btn-shine" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
