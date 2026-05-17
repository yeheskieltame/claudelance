import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import type { PostBountyState } from "./use-post-bounty-form";

const TOKENS = [
  { symbol: "cUSD", label: "cUSD" },
  { symbol: "CELO", label: "CELO" },
  { symbol: "USDC", label: "USDC" },
] as const;

interface StepOneProps {
  data: PostBountyState;
  errors: Partial<Record<keyof PostBountyState, string>>;
  update: (patch: Partial<PostBountyState>) => void;
}

export function StepOne({ data, errors, update }: StepOneProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">Token</label>
        <div className="flex gap-2">
          {TOKENS.map((t) => (
            <button
              key={t.symbol}
              type="button"
              onClick={() => update({ token: t.symbol })}
              className={cn(
                "flex-1 rounded-2xl border py-3 text-center text-sm font-medium transition-all",
                data.token === t.symbol
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:border-primary/50",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Amount ({data.token})
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="1.0"
          value={data.amount}
          onChange={(e) => update({ amount: e.target.value })}
          className={cn(
            "w-full rounded-2xl border bg-transparent px-4 py-3 text-base font-medium outline-none transition-colors",
            errors.amount
              ? "border-destructive focus:border-destructive"
              : "border-border focus:border-primary",
          )}
        />
        {errors.amount && (
          <p className="mt-1.5 text-xs text-destructive">{errors.amount}</p>
        )}
      </div>
    </div>
  );
}

interface StepTwoProps {
  data: PostBountyState;
  errors: Partial<Record<keyof PostBountyState, string>>;
  update: (patch: Partial<PostBountyState>) => void;
}

export function StepTwo({ data, errors, update }: StepTwoProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">GitHub Repository URL</label>
        <input
          type="url"
          inputMode="url"
          placeholder="https://github.com/owner/repo"
          value={data.repoUrl}
          onChange={(e) => update({ repoUrl: e.target.value })}
          className={cn(
            "w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors",
            errors.repoUrl
              ? "border-destructive focus:border-destructive"
              : "border-border focus:border-primary",
          )}
        />
        {errors.repoUrl && (
          <p className="mt-1.5 text-xs text-destructive">{errors.repoUrl}</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">GitHub Issue URL</label>
        <input
          type="url"
          inputMode="url"
          placeholder="https://github.com/owner/repo/issues/123"
          value={data.issueUrl}
          onChange={(e) => update({ issueUrl: e.target.value })}
          className={cn(
            "w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors",
            errors.issueUrl
              ? "border-destructive focus:border-destructive"
              : "border-border focus:border-primary",
          )}
        />
        {errors.issueUrl && (
          <p className="mt-1.5 text-xs text-destructive">{errors.issueUrl}</p>
        )}
      </div>
    </div>
  );
}

interface StepThreeProps {
  data: PostBountyState;
  errors: Partial<Record<keyof PostBountyState, string>>;
  update: (patch: Partial<PostBountyState>) => void;
}

export function StepThree({ data, errors, update }: StepThreeProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Worker Stake (CELO)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.1"
          value={data.stake}
          onChange={(e) => update({ stake: e.target.value })}
          className={cn(
            "w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors",
            errors.stake ? "border-destructive" : "border-border focus:border-primary",
          )}
        />
        {errors.stake && <p className="mt-1.5 text-xs text-destructive">{errors.stake}</p>}
        <p className="mt-1 text-xs text-muted-foreground">Amount each worker must stake to claim</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Max Slots</label>
        <input
          type="number"
          min="1"
          max="50"
          inputMode="numeric"
          placeholder="5"
          value={data.maxSlots}
          onChange={(e) => update({ maxSlots: e.target.value })}
          className={cn(
            "w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors",
            errors.maxSlots ? "border-destructive" : "border-border focus:border-primary",
          )}
        />
        {errors.maxSlots && <p className="mt-1.5 text-xs text-destructive">{errors.maxSlots}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Bounty Deadline (days)</label>
        <input
          type="number"
          min="1"
          max="90"
          inputMode="numeric"
          placeholder="7"
          value={data.deadlineDays}
          onChange={(e) => update({ deadlineDays: e.target.value })}
          className={cn(
            "w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors",
            errors.deadlineDays ? "border-destructive" : "border-border focus:border-primary",
          )}
        />
        {errors.deadlineDays && <p className="mt-1.5 text-xs text-destructive">{errors.deadlineDays}</p>}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">CI Required</p>
          <p className="text-xs text-muted-foreground">Workers must pass CI to submit</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={data.ciRequired}
          onClick={() => update({ ciRequired: !data.ciRequired })}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            data.ciRequired ? "bg-primary" : "bg-secondary",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              data.ciRequired && "translate-x-5",
            )}
          />
        </button>
      </div>
    </div>
  );
}

interface StepFourProps {
  data: PostBountyState;
}

export function StepFour({ data }: StepFourProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border p-4">
        <ReviewRow label="Reward" value={`${data.amount} ${data.token}`} />
        <ReviewRow label="Repository" value={data.repoUrl.split("github.com/")[1] ?? data.repoUrl} />
        <ReviewRow label="Issue" value={`#${data.issueUrl.split("/issues/")[1] ?? "—"}`} />
        <ReviewRow label="Worker Stake" value={`${data.stake} CELO`} />
        <ReviewRow label="Max Slots" value={data.maxSlots} />
        <ReviewRow label="Deadline" value={`${data.deadlineDays} days`} />
        <ReviewRow label="CI Required" value={data.ciRequired ? "Yes" : "No"} />
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        Posting will require one token approval transaction, then the bounty creation transaction.
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}