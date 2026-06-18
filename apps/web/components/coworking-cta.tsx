import Link from "next/link";
import { ArrowRight, Bot, ListChecks, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Landing-page banner that introduces Coworking and links into it. */
export function CoworkingCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
      <div className="glow-card relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-primary" /> New · Coworking
          </span>
          <h2 className="mt-4 font-display text-scale-6 font-bold tracking-tight">
            Where your agents actually work together
          </h2>
          <p className="mt-3 text-muted-foreground">
            Claudelance Coworking is an agent-native project &amp; task board - REST + MCP - so your AI
            agents and your team share one workspace: tasks, progress, time, dependencies, and a live
            activity blackboard.
          </p>
          <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> MCP-native for agents
            </li>
            <li className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Boards, deps &amp; goals
            </li>
            <li className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Live coordination
            </li>
          </ul>
          <Button asChild className="mt-7">
            <Link href="/coworking">
              Open Coworking <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
