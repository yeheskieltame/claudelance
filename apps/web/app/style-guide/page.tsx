import type { Bounty } from "@yeheskieltame/claudelance-types";
import { BountyStatus, MAINNET, ZERO_ADDRESS } from "@yeheskieltame/claudelance-types";

import { BountyCard } from "@/components/bounty-card";

const styleGuideNow = Date.UTC(2026, 4, 16, 3, 0, 0) / 1000;

const sampleBounties: Bounty[] = [
  makeBounty({
    amount: 125_000000000000000000n,
    claimedSlots: 1,
    deadlineOffset: 3 * 86_400 + 4 * 3_600,
    requirementsHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    token: MAINNET.tokens.cUSD,
  }),
  makeBounty({
    amount: 3_500000000000000000n,
    claimedSlots: 0,
    deadlineOffset: 1 * 86_400 + 8 * 3_600,
    requirementsHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    token: MAINNET.tokens.CELO,
  }),
  makeBounty({
    amount: 250_000000n,
    claimedSlots: 2,
    deadlineOffset: 5 * 86_400 + 2 * 3_600,
    requirementsHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    token: MAINNET.tokens.USDC,
  }),
];

const typeScale = [
  ["scale-1", "12 / 16", "text-scale-1"],
  ["scale-2", "14 / 20", "text-scale-2"],
  ["scale-3", "16 / 24", "text-scale-3"],
  ["scale-4", "18 / 28", "text-scale-4"],
  ["scale-5", "22 / 32", "text-scale-5"],
  ["scale-6", "28 / 36", "text-scale-6"],
  ["scale-7", "36 / 44", "text-scale-7"],
] as const;

const colorPairs = [
  ["bg.light", "#F7F9FC", "bg-bg-light text-fg-light"],
  ["bg.dark", "#090B12", "bg-bg-dark text-fg-dark"],
  ["fg.light", "#101522", "bg-fg-light text-bg-light"],
  ["fg.dark", "#F5F7FB", "bg-fg-dark text-bg-dark"],
  ["muted.light", "#647084", "bg-muted-light text-white"],
  ["muted.dark", "#9AA5B8", "bg-muted-dark text-bg-dark"],
  ["accent.light", "#4F46E5", "bg-accent-light text-white"],
  ["accent.dark", "#9B8CFF", "bg-accent-dark text-bg-dark"],
  ["success.light", "#087F5B", "bg-success-light text-white"],
  ["success.dark", "#4ADE80", "bg-success-dark text-bg-dark"],
  ["warn.light", "#9A5B00", "bg-warn-light text-white"],
  ["warn.dark", "#FACC15", "bg-warn-dark text-bg-dark"],
  ["danger.light", "#C2410C", "bg-danger-light text-white"],
  ["danger.dark", "#FB7185", "bg-danger-dark text-bg-dark"],
] as const;

const radii = [
  ["sm", "6px", "rounded-sm"],
  ["md", "8px", "rounded-md"],
  ["lg", "12px", "rounded-lg"],
  ["xl", "16px", "rounded-xl"],
  ["2xl", "24px", "rounded-2xl"],
] as const;

const motions = [
  ["default", "ease-out-quad / 180ms", "duration-normal ease-out-quad"],
  ["slow", "ease-in-out / 240ms", "duration-slow ease-in-out-smooth"],
] as const;

export default function StyleGuidePage() {
  return (
    <main className="min-h-dvh bg-bg-light px-4 py-8 text-fg-light dark:bg-bg-dark dark:text-fg-dark sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <header>
          <p className="text-scale-2 font-medium uppercase tracking-normal text-muted-light dark:text-muted-dark">
            Claudelance Style Guide
          </p>
          <h1 className="mt-3 text-scale-7 font-semibold">Fintech tokens</h1>
        </header>

        <section aria-labelledby="bounty-cards">
          <h2 id="bounty-cards" className="text-scale-5 font-semibold">
            Bounty Cards
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {sampleBounties.map((bounty) => (
              <BountyCard key={bounty.requirementsHash} bounty={bounty} now={styleGuideNow} href="/bounty/demo" />
            ))}
          </div>
        </section>

        <section aria-labelledby="type-scale">
          <h2 id="type-scale" className="text-scale-5 font-semibold">
            Type Scale
          </h2>
          <div className="mt-4 grid gap-3">
            {typeScale.map(([name, value, className]) => (
              <div key={name} className="flex items-baseline justify-between border-b border-black/10 py-3 dark:border-white/10">
                <span className={className}>The quick onchain bounty</span>
                <span className="font-mono text-scale-2 text-muted-light dark:text-muted-dark">
                  {name} - {value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="colors">
          <h2 id="colors" className="text-scale-5 font-semibold">
            Colors
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colorPairs.map(([name, value, className]) => (
              <div key={name} className={`${className} rounded-lg border border-black/10 p-4 shadow-sm`}>
                <div className="text-scale-4 font-semibold">{name}</div>
                <div className="mt-2 font-mono text-scale-2 opacity-80">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="radius">
          <h2 id="radius" className="text-scale-5 font-semibold">
            Radius
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {radii.map(([name, value, className]) => (
              <div key={name} className={`${className} border border-accent-light bg-white p-4 dark:bg-bg-dark`}>
                <div className="font-mono text-scale-2">{name}</div>
                <div className="mt-8 text-scale-3 font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="motion">
          <h2 id="motion" className="text-scale-5 font-semibold">
            Motion
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {motions.map(([name, value, className]) => (
              <div key={name} className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-bg-dark">
                <div className="font-mono text-scale-2">{name}</div>
                <div className="mt-3 text-scale-4 font-semibold">{value}</div>
                <div className={`mt-4 h-2 w-24 rounded-full bg-accent-light transition-all ${className} hover:w-full`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function makeBounty({
  amount,
  claimedSlots,
  deadlineOffset,
  requirementsHash,
  token,
}: {
  amount: bigint;
  claimedSlots: number;
  deadlineOffset: number;
  requirementsHash: `0x${string}`;
  token: `0x${string}`;
}): Bounty {
  return {
    poster: "0x1111111111111111111111111111111111111111",
    amount,
    winner: ZERO_ADDRESS,
    stakeRequired: 1_000000000000000000n,
    token,
    deadline: BigInt(styleGuideNow + deadlineOffset),
    maxSlots: 3,
    claimedSlots,
    bountyType: 0,
    ciRequired: true,
    targetWorker: ZERO_ADDRESS,
    status: BountyStatus.Open,
    targetRepoUrl: "https://github.com/yeheskieltame/claudelance",
    instructionUrl: "https://github.com/yeheskieltame/claudelance/issues/149",
    requirementsHash,
  };
}
