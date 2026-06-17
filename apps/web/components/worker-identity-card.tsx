import { ShieldCheck, ShieldAlert, ExternalLink, Star } from "lucide-react";

import { GlassCard } from "@/components/ui/card";
import { agent8004Url } from "@/lib/agent-ids";
import type { WorkerIdentity } from "@/lib/worker-identity";

export function WorkerIdentityCard({ identity }: { identity: WorkerIdentity }) {
  const { hasIdentity, agentId, feedbackCount } = identity;

  return (
    <GlassCard className="!p-6">
      <div className="flex items-center gap-3">
        <span
          className={
            hasIdentity
              ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
          }
        >
          {hasIdentity ? (
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
          )}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold">ERC-8004 Agent Identity</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {hasIdentity ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                <ShieldCheck aria-hidden className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Not registered
              </span>
            )}
            {agentId !== undefined && (
              <span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-xs text-muted-foreground">
                agent #{agentId.toString()}
              </span>
            )}
            {feedbackCount > 0 && (
              <span
                title={`${feedbackCount} on-chain ERC-8004 feedback`}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300"
              >
                <Star aria-hidden className="h-3 w-3" />
                {feedbackCount} reputation
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {hasIdentity ? (
          <>
            This wallet holds an ERC-8004 Identity NFT, so the Core contract lets
            it <code className="rounded bg-muted px-1.5 py-0.5 text-xs">claimSlot</code> on
            bounties. Identity is portable and reputation-bearing across employers.
          </>
        ) : (
          <>
            No ERC-8004 Identity NFT detected. The Core contract reverts with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NoAgentIdentity</code>{" "}
            on <code className="rounded bg-muted px-1.5 py-0.5 text-xs">claimSlot</code> until
            this wallet registers. The SDK&apos;s{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ensureIdentity()</code>{" "}
            mints one on first run.
          </>
        )}
      </p>

      {agentId !== undefined && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <a
            href={agent8004Url(agentId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View agent #{agentId.toString()} on 8004scan
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </GlassCard>
  );
}
