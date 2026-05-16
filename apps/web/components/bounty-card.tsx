import * as React from "react";
import type { Bounty } from "@yeheskieltame/claudelance-types";
import { MAINNET, SEPOLIA } from "@yeheskieltame/claudelance-types";

import { cn } from "@/lib/utils";

type TokenMeta = {
  symbol: "cUSD" | "CELO" | "USDC" | "TOKEN";
  decimals: number;
  chipClassName: string;
};

export type BountyCardProps = {
  bounty: Bounty;
  className?: string;
  href?: string;
  now?: number;
};

const tokenCatalog = [
  {
    symbol: "cUSD",
    decimals: 18,
    addresses: [MAINNET.tokens.cUSD, SEPOLIA.tokens.cUSD],
    chipClassName:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  },
  {
    symbol: "CELO",
    decimals: 18,
    addresses: [MAINNET.tokens.CELO, SEPOLIA.tokens.CELO],
    chipClassName:
      "border-amber-500/30 bg-amber-400/15 text-amber-700 dark:text-amber-200",
  },
  {
    symbol: "USDC",
    decimals: 6,
    addresses: [MAINNET.tokens.USDC, SEPOLIA.tokens.USDC],
    chipClassName:
      "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  },
] as const;

const fallbackToken: TokenMeta = {
  symbol: "TOKEN",
  decimals: 18,
  chipClassName: "border-border bg-muted text-muted-foreground",
};

export function BountyCard({ bounty, className, href, now }: BountyCardProps) {
  const token = getBountyTokenMeta(bounty.token);
  const title = getBountyTitle(bounty);
  const description = getBountyDescription(bounty);
  const cardHref = href ?? bounty.instructionUrl;
  const isExternal = /^https?:\/\//.test(cardHref);

  return (
    <article
      className={cn(
        "w-full rounded-lg border border-border bg-card text-card-foreground shadow-sm transition duration-200 ease-out",
        "[@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-glow",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        className,
      )}
      data-token={token.symbol}
    >
      <a
        href={cardHref}
        className="block p-4 outline-none sm:p-5"
        {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold leading-6">{title}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
          <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {bounty.claimedSlots}/{bounty.maxSlots}
          </span>
        </div>

        <footer className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span
            className={cn(
              "inline-flex min-w-0 items-center rounded-full border px-3 py-1 text-xs font-semibold",
              token.chipClassName,
            )}
          >
            {formatTokenAmount(bounty.amount, token.decimals)} {token.symbol}
          </span>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {formatDeadlineCountdown(bounty.deadline, now)}
          </span>
        </footer>
      </a>
    </article>
  );
}

export function getBountyTokenMeta(token: `0x${string}`): TokenMeta {
  const normalized = token.toLowerCase();
  return (
    tokenCatalog.find((item) => item.addresses.some((address) => address.toLowerCase() === normalized)) ??
    fallbackToken
  );
}

export function getBountyTitle(bounty: Pick<Bounty, "targetRepoUrl" | "requirementsHash">) {
  const repoName = formatRepoName(bounty.targetRepoUrl);
  return repoName ? `${repoName} bounty` : `Bounty ${shortHash(bounty.requirementsHash)}`;
}

export function getBountyDescription(bounty: Pick<Bounty, "instructionUrl" | "requirementsHash" | "ciRequired">) {
  const source = formatHost(bounty.instructionUrl);
  const ci = bounty.ciRequired ? "CI required" : "Manual review";
  return `${ci} for requirements ${shortHash(bounty.requirementsHash)}${source ? ` from ${source}` : ""}.`;
}

export function formatDeadlineCountdown(deadline: bigint, now = Math.floor(Date.now() / 1000)) {
  const seconds = Number(deadline - BigInt(now));
  if (seconds <= 0) return "Expired";

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days > 0) return `Due in ${days}d ${hours}h`;
  if (hours > 0) return `Due in ${hours}h ${minutes}m`;
  return `Due in ${Math.max(minutes, 1)}m`;
}

export function formatTokenAmount(amount: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  const trimmedFraction = fraction.toString().padStart(decimals, "0").slice(0, 2).replace(/0+$/, "");

  return trimmedFraction ? `${whole.toString()}.${trimmedFraction}` : whole.toString();
}

function formatRepoName(targetRepoUrl: string) {
  try {
    const url = new URL(targetRepoUrl);
    const [owner, repo] = url.pathname.replace(/^\/|\/$/g, "").split("/");
    return owner && repo ? `${owner}/${repo}` : url.hostname;
  } catch {
    return targetRepoUrl.replace(/^https?:\/\//, "").replace(/^\/|\/$/g, "");
  }
}

function formatHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function shortHash(hash: `0x${string}`) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
