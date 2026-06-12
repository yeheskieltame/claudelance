import { unstable_cache } from "next/cache";
import { ArrowRight, CalendarClock, Coins } from "lucide-react";
import Link from "next/link";
import { MAINNET, ZERO_ADDRESS } from "@yeheskieltame/claudelance-types";

import { readBountyPage } from "@/lib/bounty-reads";
import { formatTokenAmount } from "@/lib/format-token";
import { Reveal } from "@/components/motion/reveal";

const TOKEN_STYLES: Record<string, string> = {
  cusd: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  celo: "border-primary/30 bg-primary/10 text-primary",
  usdc: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
};

type ApiBounty = {
  id?: string | number;
  title?: string;
  description?: string;
  targetRepoUrl?: string;
  instructionUrl?: string;
  token?: string;
  tokenSymbol?: string;
  amount?: string | number;
  deadline?: string | number;
  status?: number;
  claimedSlots?: number;
  maxSlots?: number;
  targetWorker?: string;
};

// Direct chain read instead of a self-fetch through /api/bounties; the
// unstable_cache window keeps the landing page ISR-fresh without an RPC scan
// per regeneration burst.
const readOpenBounties = unstable_cache(
  () => readBountyPage({ status: "open", limit: 12 }),
  ["home-open-bounties"],
  { revalidate: 30 },
);

export async function BountiesScroll() {
  let items: ApiBounty[] = [];

  try {
    const { items: open } = await readOpenBounties();
    // Landing shows only open-marketplace bounties (skip direct hires), max 3.
    items = open
      .filter((b) => !b.targetWorker || b.targetWorker === ZERO_ADDRESS)
      .slice(0, 3);
  } catch {
    // Silently fall back; section hidden when no open bounties
  }

  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
            Open bounties
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Work waiting onchain.
          </h2>
        </div>
        <Link
          href="/bounties"
          className="touch-target inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((bounty, i) => (
          <Reveal key={bounty.id ?? i} delay={i * 0.07} className="shrink-0 snap-start">
            <BountyMiniCard bounty={bounty} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function BountyMiniCard({ bounty }: { bounty: ApiBounty }) {
  const { symbol: token, decimals } = resolveToken(bounty.token ?? "");
  const tokenStyle =
    TOKEN_STYLES[token.toLowerCase()] ?? "border-border bg-muted text-muted-foreground";
  const amount = formatAmount(bounty.amount, decimals);
  const deadline = formatDeadline(bounty.deadline);
  const title = bounty.title ?? deriveTitle(bounty);
  const href = bounty.instructionUrl ?? bounty.targetRepoUrl ?? `/bounty/${bounty.id ?? ""}`;

  return (
    <article className="glow-card group flex h-full w-72 flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.7rem] font-semibold uppercase ${tokenStyle}`}
        >
          {token}
        </span>
        <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
          {bounty.claimedSlots ?? 0}/{bounty.maxSlots ?? 1} slots
        </span>
      </div>

      <h3 className="mt-4 line-clamp-2 min-h-[3rem] text-[0.95rem] font-semibold leading-6">
        {title}
      </h3>

      <div className="mt-4 flex items-center gap-4 font-mono text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          {amount} {token}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {deadline}
        </span>
      </div>

      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:gap-2.5"
      >
        View bounty
        <ArrowRight className="h-3.5 w-3.5 transition-all" />
      </Link>
    </article>
  );
}

function resolveToken(address: string): { symbol: string; decimals: number } {
  const a = address.toLowerCase();
  if (a === MAINNET.tokens.USDC.toLowerCase()) return { symbol: "USDC", decimals: 6 };
  if (a === MAINNET.tokens.cUSD.toLowerCase()) return { symbol: "cUSD", decimals: 18 };
  if (a === MAINNET.tokens.CELO.toLowerCase()) return { symbol: "CELO", decimals: 18 };
  return { symbol: "cUSD", decimals: 18 };
}

function formatAmount(amount: ApiBounty["amount"], decimals: number): string {
  if (amount === undefined || amount === null || amount === "") return "0";
  try {
    return formatTokenAmount(BigInt(String(amount)), decimals, 2);
  } catch {
    return "0";
  }
}

function formatDeadline(deadline: ApiBounty["deadline"]) {
  if (!deadline) return "No deadline";
  const numeric = Number(deadline);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(deadline as string);
  if (Number.isNaN(date.getTime())) return "No deadline";

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays <= 0) return "Expired";
  if (diffDays === 1) return "1 day left";
  return `${diffDays}d left`;
}

function deriveTitle(bounty: ApiBounty) {
  if (bounty.targetRepoUrl) {
    return bounty.targetRepoUrl
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\/issues\/\d+$/, "");
  }
  return `Bounty ${bounty.id ?? ""}`.trim();
}
