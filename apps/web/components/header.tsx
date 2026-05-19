"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

const navLinks = [
  {
    href: "/bounties",
    label: "Bounties",
    match: (path: string) =>
      path === "/bounties" || path.startsWith("/bounties/") || path.startsWith("/bounty/"),
  },
  { href: "/post", label: "Post", match: (path: string) => path === "/post" || path.startsWith("/post/") },
  {
    href: "/workers",
    label: "Workers",
    match: (path: string) => path === "/workers" || path.startsWith("/workers/"),
  },
  { href: "/revenue", label: "Revenue", match: (path: string) => path === "/revenue" || path.startsWith("/revenue/") },
] as const;

export function Header() {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-6xl px-4">
      <nav className="glass flex h-14 items-center justify-between rounded-full px-4 sm:h-16 sm:px-6">
        <Link href="/" className="touch-target -ml-2 inline-flex items-center gap-2 rounded-full px-2">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Claudelance
          </span>
        </Link>

        <ul className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          {navLinks.map((link) => {
            const active = link.match(pathname);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "touch-target inline-flex items-center rounded-full px-3 transition-colors hover:text-foreground",
                    active && "bg-primary/10 text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
