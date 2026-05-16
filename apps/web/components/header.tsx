"use client";

import Link from "next/link";
import { Github, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-6xl px-4">
      <nav className="flex h-14 items-center justify-between rounded-sm border border-[#c9decf] bg-white/90 px-4 shadow-sm backdrop-blur sm:h-16 sm:px-6 dark:border-[#203b33] dark:bg-[#0c1714]/90">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-sm bg-[#35d07f] text-[#062013]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden text-sm font-semibold sm:inline">
            Claudelance
          </span>
        </Link>

        <ul className="hidden items-center gap-2 text-sm text-[#5d6c64] md:flex dark:text-[#a8bbb2]">
          <li><Link href="#bounties" className="rounded-sm px-3 py-2 hover:bg-[#eef5ea] hover:text-[#163821] dark:hover:bg-[#14251f] dark:hover:text-white">Bounties</Link></li>
          <li><Link href="#how-it-works" className="rounded-sm px-3 py-2 hover:bg-[#eef5ea] hover:text-[#163821] dark:hover:bg-[#14251f] dark:hover:text-white">Flow</Link></li>
          <li><Link href="/revenue" className="rounded-sm px-3 py-2 hover:bg-[#eef5ea] hover:text-[#163821] dark:hover:bg-[#14251f] dark:hover:text-white">Revenue</Link></li>
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" className="hidden rounded-sm bg-[#35d07f] text-[#062013] shadow-none hover:bg-[#2fc070] hover:shadow-none sm:inline-flex" asChild>
            <Link href="https://github.com/yeheskieltame/claudelance" target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
              GitHub
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
