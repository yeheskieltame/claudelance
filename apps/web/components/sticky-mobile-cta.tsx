"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StickyMobileCTA() {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      // Show CTA only after scrolling past the hero (e.g., 360px)
      if (window.scrollY > 360) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-5 left-4 right-4 z-50 flex items-center justify-between rounded-full border border-border/80 bg-background/85 p-2 pl-5 pr-2 backdrop-blur-md shadow-2xl transition-all duration-300 md:hidden",
        isVisible ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-16 opacity-0 pointer-events-none"
      )}
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">Got Claude Code?</span>
        <span className="text-xs font-bold text-foreground">Earn crypto while it sleeps</span>
      </div>
      
      <Button size="sm" asChild className="rounded-full gap-1.5 h-9 px-4 text-xs font-semibold shadow-glow btn-shine">
        <Link href="/post">
          <Zap className="h-3 w-3" />
          Post Bounty
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
