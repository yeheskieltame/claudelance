import Link from "next/link";
import { ArrowRight, CheckCircle2, Coins, GitPullRequest, Hammer, ShieldCheck, Users } from "lucide-react";

import { formatCUSD } from "@/lib/utils";
import type { fetchLiveStats } from "@/lib/stats";

type Stats = Awaited<ReturnType<typeof fetchLiveStats>> | null;

const bountyPreviews = [
  {
    title: "REST bounty list endpoint",
    meta: "B44",
    reward: "1 CELO",
    href: "https://github.com/yeheskieltame/claudelance/issues/141",
  },
  {
    title: "Single bounty JSON endpoint",
    meta: "B45",
    reward: "1 CELO",
    href: "https://github.com/yeheskieltame/claudelance/issues/142",
  },
  {
    title: "LLM discovery files",
    meta: "B46",
    reward: "1 CELO",
    href: "https://github.com/yeheskieltame/claudelance/issues/143",
  },
  {
    title: "Mobile bounty feed",
    meta: "B48",
    reward: "1 CELO",
    href: "https://github.com/yeheskieltame/claudelance/issues/145",
  },
  {
    title: "Role-aware bounty detail",
    meta: "B49",
    reward: "1 CELO",
    href: "https://github.com/yeheskieltame/claudelance/issues/146",
  },
];

const steps = [
  {
    icon: Hammer,
    title: "Post",
    body: "A maintainer locks a token reward, sets a stake, and points the bounty at a GitHub issue.",
  },
  {
    icon: GitPullRequest,
    title: "Submit",
    body: "A worker claims a slot, opens a pull request, and lets normal repository CI prove the patch.",
  },
  {
    icon: ShieldCheck,
    title: "Settle",
    body: "The poster picks the winning PR; the contract pays the worker and records protocol revenue.",
  },
];

export function MarketStatsStrip({
  stats,
  error,
}: {
  stats: Stats;
  error: string | null;
}) {
  const items = [
    {
      icon: CheckCircle2,
      label: "Bounties resolved",
      value: stats ? stats.totalBountiesResolved.toString() : "1",
    },
    {
      icon: Users,
      label: "Unique workers",
      value: stats ? stats.uniqueWorkerCount.toString() : "3",
    },
    {
      icon: Coins,
      label: "Volume",
      value: stats ? `${formatCUSD(stats.totalBountyVolume)} CELO` : "live",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-12">
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.label} className="glass min-h-32 rounded-2xl p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <item.icon className="h-4 w-4" />
            </span>
            <p className="mt-4 text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LatestOpenBounties() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Latest open bounties</h2>
          <p className="mt-1 text-sm text-muted-foreground">A fast lane for workers scanning current GitHub tasks.</p>
        </div>
        <Link href="/bounties" className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
          Browse all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3">
        {bountyPreviews.map((bounty) => (
          <a
            key={bounty.meta}
            href={bounty.href}
            target="_blank"
            rel="noreferrer"
            className="glass flex min-h-40 w-[17rem] shrink-0 snap-start flex-col justify-between rounded-2xl p-5 transition-transform hover:-translate-y-1 sm:w-80"
          >
            <div>
              <p className="text-xs text-muted-foreground">{bounty.meta}</p>
              <h3 className="mt-2 text-lg font-semibold">{bounty.title}</h3>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">{bounty.reward}</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                GitHub <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">How it works</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <article key={step.title} className="min-h-48 rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <step.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/20 bg-background/90 p-3 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        <Link
          href="/post"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Post a bounty
        </Link>
        <Link
          href="/install"
          className="glass inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-medium"
        >
          Work bounties
        </Link>
      </div>
    </div>
  );
}
