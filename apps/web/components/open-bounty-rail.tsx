import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";

const bounties = [
  {
    id: "B49",
    title: "Bounty detail page",
    body: "Role-aware claim, submit, and winner-pick flow for a single bounty.",
    token: "CELO",
    reward: "1",
    href: "https://github.com/yeheskieltame/claudelance/issues/146",
  },
  {
    id: "B50",
    title: "Poster form",
    body: "Mobile multi-step flow for token, repo, stake, deadline, and review.",
    token: "CELO",
    reward: "1",
    href: "https://github.com/yeheskieltame/claudelance/issues/147",
  },
  {
    id: "B51",
    title: "Wallet button",
    body: "Unified MiniPay, Privy, and injected wallet entrypoint.",
    token: "CELO",
    reward: "1",
    href: "https://github.com/yeheskieltame/claudelance/issues/148",
  },
  {
    id: "B52",
    title: "Bounty card",
    body: "Compact mobile-first bounty cards with token color semantics.",
    token: "CELO",
    reward: "1",
    href: "https://github.com/yeheskieltame/claudelance/issues/149",
  },
  {
    id: "B53",
    title: "Bottom navigation",
    body: "Four-icon mobile nav with active route and safe-area spacing.",
    token: "CELO",
    reward: "1",
    href: "https://github.com/yeheskieltame/claudelance/issues/150",
  },
];

export function OpenBountyRail() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-16 sm:pt-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Latest open bounties
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Fresh work in the marketplace
          </h2>
        </div>
        <Link
          href="https://github.com/yeheskieltame/claudelance/issues?q=is%3Aissue+is%3Aopen+label%3Abounty-open"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {bounties.map((bounty) => (
          <Link
            key={bounty.id}
            href={bounty.href}
            target="_blank"
            rel="noreferrer"
            className="glass min-h-[190px] w-[78vw] max-w-[310px] shrink-0 snap-start rounded-3xl p-5 transition-transform hover:-translate-y-1 sm:w-[290px]"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-200">
                {bounty.id}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                {bounty.reward} {bounty.token}
              </span>
            </div>
            <h3 className="mt-5 line-clamp-1 text-lg font-semibold tracking-tight">
              {bounty.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{bounty.body}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              7 day claim window
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
