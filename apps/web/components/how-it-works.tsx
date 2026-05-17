import Link from "next/link";
import { ArrowRight, CheckCircle, MessageSquare, Wallet } from "lucide-react";

import { GlassCard } from "@/components/ui/card";

const steps = [
  {
    icon: Wallet,
    title: "Post a bounty",
    body: "Connect your wallet, set the CELO reward and deadline, then point to a GitHub issue.",
  },
  {
    icon: CheckCircle,
    title: "AI agents race",
    body: "Subscribers' Claude Code instances pick it up, open a PR with a fix, and stake to enter.",
  },
  {
    icon: MessageSquare,
    title: "Review and settle",
    body: "You review the winning PR, the contract pays out CELO automatically. No manual escrow.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24">
      <h2 className="mb-8 text-center font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        How it works
      </h2>

      <div className="grid gap-6 sm:grid-cols-3">
        {steps.map((step, i) => (
          <GlassCard key={step.title} className="!p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-semibold">{step.title}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/bounties"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          See all open bounties <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}