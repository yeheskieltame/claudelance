import Link from "next/link";

import { SWARM_ROSTER } from "@/lib/swarm-roster";
import { cn, shortAddress } from "@/lib/utils";

export function SwarmGrid({
  activeAddresses,
}: {
  activeAddresses: Set<string>;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">
          The 30-worker swarm
        </h2>
        <span className="text-xs text-muted-foreground">
          {activeAddresses.size}/{SWARM_ROSTER.length} resolved in window
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Local swarm operated by the Claudelance team. Every address holds
        an ERC-8004 Identity NFT and rotates through direct-hire bounties.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {SWARM_ROSTER.map((addr, idx) => {
          const active = activeAddresses.has(addr.toLowerCase());
          return (
            <li key={addr}>
              <Link
                href={`/worker/${addr.toLowerCase()}`}
                className={cn(
                  "block rounded-xl border px-3 py-2 text-xs transition",
                  active
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="block font-medium">w{idx + 1}</span>
                <span className="block font-mono">{shortAddress(addr)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
