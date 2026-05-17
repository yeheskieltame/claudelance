import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";

import { Button } from "@/components/ui/button";

export function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-lg sm:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Button size="sm" asChild className="flex-1">
          <Link href="/post">
            Post a bounty <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button size="sm" variant="glass" asChild>
          <Link href="/install">
            <Github className="h-4 w-4" /> Worker
          </Link>
        </Button>
      </div>
    </div>
  );
}