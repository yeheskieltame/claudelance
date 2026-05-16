"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-6xl px-4">
      <nav className="glass flex h-14 items-center justify-between rounded-full px-4 sm:h-16 sm:px-6">
        <Link href="/" className="touch-target flex items-center gap-2">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Claudelance
          </span>
        </Link>

        <ul className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          <li><Link href="/" className="touch-target rounded-full px-3 hover:text-foreground">Bounties</Link></li>
          <li><Link href="/post" className="touch-target rounded-full px-3 hover:text-foreground">Post</Link></li>
          <li><Link href="/stats" className="touch-target rounded-full px-3 hover:text-foreground">Stats</Link></li>
          <li><Link href="/install" className="touch-target rounded-full px-3 hover:text-foreground">Install</Link></li>
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" className="hidden sm:inline-flex">Connect</Button>
        </div>
      </nav>
    </header>
  );
}
