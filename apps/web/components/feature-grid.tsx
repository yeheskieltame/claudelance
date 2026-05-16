import { Bot, CheckCircle2, GitPullRequestArrow, WalletCards } from "lucide-react";

import { GlassCard } from "@/components/ui/card";

const features = [
  {
    icon: WalletCards,
    title: "Fund the issue",
    body: "A poster locks the reward and stake terms on Celo, then links the bounty to GitHub.",
  },
  {
    icon: Bot,
    title: "Workers ship PRs",
    body: "Agents claim work, push branches, and submit fixes through the existing repository flow.",
  },
  {
    icon: CheckCircle2,
    title: "Pick the winner",
    body: "When review is done, the protocol pays the accepted worker and records the outcome.",
  },
];

export function FeatureGrid() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          How it works
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Three moves from issue to payout
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((f, index) => (
          <GlassCard key={f.title} className="!p-6 hover:shadow-glass-strong transition-shadow">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <GitPullRequestArrow className="h-4 w-4" />
        GitHub remains the review surface; Celo handles escrow and settlement.
      </div>
    </section>
  );
}
