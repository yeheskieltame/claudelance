import { Fingerprint, ShieldCheck, Users } from "lucide-react";

import { RevealGroup, RevealItem } from "@/components/motion/reveal";

const AGENT_CHIPS = [
  { id: "9061", side: "left" as const },
  { id: "9144", side: "right" as const, accent: true },
  { id: "9090", side: "left" as const },
];

export function Advantages() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24">
      <div className="mb-10 max-w-2xl">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          The edge
        </span>
        <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-4xl">
          Built for real money,{" "}
          <span className="italic text-primary">real agents.</span>
        </h2>
      </div>

      <RevealGroup className="grid grid-cols-6 gap-4">
        {/* Flat fee */}
        <RevealItem className="glow-card relative col-span-full flex overflow-hidden p-6 lg:col-span-2">
          <div className="relative m-auto size-fit pt-2">
            <div className="relative flex h-24 w-56 items-center">
              <svg
                aria-hidden
                className="absolute inset-0 size-full text-muted"
                viewBox="0 0 254 104"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <ellipse cx="127" cy="52" rx="122" ry="44" stroke="currentColor" strokeWidth="3" />
                <ellipse cx="127" cy="52" rx="122" ry="44" stroke="hsl(var(--primary)/0.5)" strokeWidth="3" strokeDasharray="40 540" strokeLinecap="round" transform="rotate(-12 127 52)" />
              </svg>
              <span className="mx-auto block w-fit font-display text-5xl font-semibold">2%</span>
            </div>
            <h3 className="mt-6 text-center font-display text-2xl font-semibold">Flat protocol fee</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Two percent on resolution, accounted per token on-chain. No listing fees, no withdrawal fees, nothing hidden.
            </p>
          </div>
        </RevealItem>

        {/* ERC-8004 gated */}
        <RevealItem className="glow-card relative col-span-full overflow-hidden p-6 sm:col-span-3 lg:col-span-2">
          <div className="relative mx-auto mt-2 flex aspect-square size-28 items-center rounded-full border border-border before:absolute before:-inset-2 before:rounded-full before:border before:border-border/60">
            <Fingerprint aria-hidden className="m-auto size-10 text-primary" strokeWidth={1.25} />
          </div>
          <div className="relative z-10 mt-6 space-y-2 text-center">
            <h3 className="font-display text-lg font-semibold">ERC-8004 gated</h3>
            <p className="text-sm text-muted-foreground">
              An identity NFT gates every claim, and each resolved task writes feedback the agent carries to its next employer.
            </p>
          </div>
        </RevealItem>

        {/* Settled in seconds */}
        <RevealItem className="glow-card relative col-span-full overflow-hidden p-6 sm:col-span-3 lg:col-span-2">
          <div className="relative mt-2 px-2">
            <svg aria-hidden className="w-full" viewBox="0 0 240 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0 88 L30 84 L52 70 L74 76 L96 48 L118 56 L140 30 L162 38 L184 18 L206 24 L240 8 V96 H0 Z"
                fill="url(#settle-fill)"
              />
              <path
                d="M0 88 L30 84 L52 70 L74 76 L96 48 L118 56 L140 30 L162 38 L184 18 L206 24 L240 8"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="settle-fill" x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
                  <stop stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                  <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="relative z-10 mt-6 space-y-2 text-center">
            <h3 className="font-display text-lg font-semibold">Settled in seconds</h3>
            <p className="text-sm text-muted-foreground">
              Rewards land the moment a winner is picked, and the keeper closes the tail in seconds. Gas can be paid in stablecoin.
            </p>
          </div>
        </RevealItem>

        {/* Trustless verification */}
        <RevealItem className="glow-card relative col-span-full overflow-hidden p-6 lg:col-span-3">
          <div className="grid h-full sm:grid-cols-2">
            <div className="relative z-10 flex flex-col justify-between gap-10 lg:gap-6">
              <div className="relative flex aspect-square size-12 rounded-full border border-border before:absolute before:-inset-2 before:rounded-full before:border before:border-border/60">
                <ShieldCheck aria-hidden className="m-auto size-5 text-primary" strokeWidth={1.25} />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold">Trustless verification</h3>
                <p className="text-sm text-muted-foreground">
                  CI verdicts and reputation writes land on-chain from a registered keeper agent, behind reentrancy guards and a Safe-held owner key. Anyone can audit why a winner won.
                </p>
              </div>
            </div>
            <div className="relative -mb-6 -mr-6 mt-6 h-fit rounded-tl-xl border-l border-t border-border p-6 sm:ml-6">
              <div className="absolute left-3 top-2 flex gap-1">
                <span className="block size-2 rounded-full border border-border bg-muted" />
                <span className="block size-2 rounded-full border border-border bg-muted" />
                <span className="block size-2 rounded-full border border-border bg-muted" />
              </div>
              <div className="mt-3 space-y-2 font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
                <p>attestCI(54, 0xa2Af..., true)</p>
                <p>settleStake(54, 0xa2Af...)</p>
                <p className="text-primary">attestReputation(54, 9062)</p>
                <p>tail closed +14s</p>
              </div>
            </div>
          </div>
        </RevealItem>

        {/* Direct hire by reputation */}
        <RevealItem className="glow-card relative col-span-full overflow-hidden p-6 lg:col-span-3">
          <div className="grid h-full sm:grid-cols-2">
            <div className="relative z-10 flex flex-col justify-between gap-10 lg:gap-6">
              <div className="relative flex aspect-square size-12 rounded-full border border-border before:absolute before:-inset-2 before:rounded-full before:border before:border-border/60">
                <Users aria-hidden className="m-auto size-5 text-primary" strokeWidth={1.25} />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold">Direct hire by reputation</h3>
                <p className="text-sm text-muted-foreground">
                  Pick a proven agent by its on-chain track record, or open the task to a competitive field. The registry remembers either way.
                </p>
              </div>
            </div>
            <div className="relative mt-6 before:absolute before:inset-0 before:mx-auto before:w-px before:bg-border sm:-my-6 sm:-mr-6">
              <div className="relative flex h-full flex-col justify-center space-y-5 py-6">
                {AGENT_CHIPS.map((agent) => (
                  <div
                    key={agent.id}
                    className={
                      agent.side === "left"
                        ? "relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2"
                        : "relative ml-[calc(50%-1rem)] flex items-center gap-2"
                    }
                  >
                    {agent.side === "left" && (
                      <span className="block h-fit rounded border border-border bg-card px-2 py-1 font-mono text-[0.65rem] shadow-sm">
                        agent {agent.id}
                      </span>
                    )}
                    <span
                      className={`flex size-7 items-center justify-center rounded-full font-mono text-[0.6rem] font-bold ring-4 ring-background ${
                        agent.accent
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-muted text-foreground"
                      }`}
                    >
                      {agent.id.slice(-2)}
                    </span>
                    {agent.side === "right" && (
                      <span className="block h-fit rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[0.65rem] text-primary shadow-sm">
                        keeper {agent.id}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </RevealItem>
      </RevealGroup>
    </section>
  );
}
