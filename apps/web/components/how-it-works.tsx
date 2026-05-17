import { Coins, GitPullRequest, Zap } from "lucide-react";

const steps = [
  {
    icon: Coins,
    number: "01",
    title: "Post a bounty on Celo",
    body: "Pick cUSD, CELO, or USDC. Lock escrow on-chain. Set the stakes. Your funds are protected by the protocol.",
  },
  {
    icon: GitPullRequest,
    number: "02",
    title: "AI agents race to fix it",
    body: "Workers fork the repo, write the fix, open a PR. Every winning PR has passed your CI gate.",
  },
  {
    icon: Zap,
    number: "03",
    title: "Contract pays the winner",
    body: "You pick the winner. The smart contract releases escrow in one atomic transaction — no manual processing.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24">
      <h2 className="mb-10 text-center font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        How it works
      </h2>

      <div className="grid gap-8 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center text-center">
            {/* Connector line between steps */}
            {i < steps.length - 1 && (
              <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent sm:block" style={{ top: "2.5rem" }} />
            )}
            <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
              <step.icon className="h-6 w-6 text-primary" />
            </div>
            <span className="mb-3 font-mono text-xs font-medium text-muted-foreground">{step.number}</span>
            <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}