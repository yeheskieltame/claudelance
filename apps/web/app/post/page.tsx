"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Coins, GitBranch, Settings, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

// ─── Zod Schema (B50 spec) ───────────────────────────────────────────────────

const tokenSchema = z.enum(["cUSD", "CELO", "USDC"]);
const step1Schema = z.object({ token: tokenSchema, amount: z.number().positive("Must be > 0") });
const step2Schema = z.object({ repoUrl: z.string().url("Invalid URL"), issueUrl: z.string().url("Invalid URL") });
const step3Schema = z.object({
  stake: z.number().positive("Must be > 0"),
  maxSlots: z.number().int().min(1).max(20),
  deadlineDays: z.number().int().min(1).max(14),
  ciRequired: z.boolean(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

type FormState = Step1Data & Step2Data & Step3Data & {
  step: number;
  confirmed: boolean;
};

const TOKEN_DECIMALS: Record<string, number> = { cUSD: 18, CELO: 18, USDC: 6 };

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostBountyPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    step: 1,
    token: "CELO",
    amount: 1,
    repoUrl: "",
    issueUrl: "",
    stake: 0.1,
    maxSlots: 5,
    deadlineDays: 7,
    ciRequired: false,
    confirmed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateForm = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const validateStep = (s: number): boolean => {
    setErrors({});
    try {
      if (s === 1) step1Schema.parse(form);
      else if (s === 2) step2Schema.parse(form);
      else if (s === 3) step3Schema.parse(form);
      else if (s === 4) { if (!form.confirmed) { setErrors({ confirmed: "Must confirm to post" }); return false; } }
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        const map: Record<string, string> = {};
        e.errors.forEach((err) => { if (err.path[0]) map[String(err.path[0])] = err.message; });
        setErrors(map);
      }
      return false;
    }
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, 4)); };
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setSubmitting(true);
    try {
      // TODO: wire to wagmi writeContract -> postBounty / postBountyWithApproval
      // using @yeheskieltame/claudelance-sdk ClaudelanceClient
      await new Promise((r) => setTimeout(r, 1000)); // placeholder
      setSubmitted(true);
    } catch {
      setErrors({ _: "Submission failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 text-center">
        <CheckCircle className="h-16 w-16 text-emerald-500" />
        <h1 className="mt-6 text-2xl font-bold">Bounty Posted!</h1>
        <p className="mt-2 text-muted-foreground">Your bounty is now live on Celo mainnet.</p>
        <Link href="/bounties">
          <Button className="mt-6">Browse Bounties</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Post a Bounty</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a new bounty on Claudelance</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2">
          {[1, 2, 3, 4].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-emerald-500 text-white" : "border border-border bg-muted text-muted-foreground"}`}>
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              {i < 3 && <div className={`h-px w-8 flex-1 ${step > s ? "bg-emerald-500" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {step === 1 && <Step1 form={form} errors={errors} updateForm={updateForm} />}
          {step === 2 && <Step2 form={form} errors={errors} updateForm={updateForm} />}
          {step === 3 && <Step3 form={form} errors={errors} updateForm={updateForm} />}
          {step === 4 && <Step4 form={form} errors={errors} updateForm={updateForm} />}

          {errors._ && <p className="mt-4 text-sm text-red-500">{errors._}</p>}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={back} disabled={step === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 4 ? (
            <Button onClick={next}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Posting..." : "Post Bounty"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

const inputClass = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function Step1({ form, errors, updateForm }: { form: FormState; errors: Record<string, string>; updateForm: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Coins className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Token & Amount</h2>
      </div>
      <p className="text-sm text-muted-foreground">Choose the reward token and amount for your bounty.</p>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Token</label>
        <div className="flex gap-2">
          {(["cUSD", "CELO", "USDC"] as const).map((t) => (
            <button key={t} type="button" onClick={() => updateForm({ token: t })} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${form.token === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted hover:border-primary/50"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Amount</label>
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => updateForm({ amount: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="1.0" />
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
      </div>
    </div>
  );
}

function Step2({ form, errors, updateForm }: { form: FormState; errors: Record<string, string>; updateForm: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <GitBranch className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Repository & Issue</h2>
      </div>
      <p className="text-sm text-muted-foreground">Link the GitHub repository and issue for this bounty.</p>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Repository URL</label>
        <input type="url" value={form.repoUrl} onChange={(e) => updateForm({ repoUrl: e.target.value })} className={inputClass} placeholder="https://github.com/owner/repo" />
        {errors.repoUrl && <p className="mt-1 text-xs text-red-500">{errors.repoUrl}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Issue URL</label>
        <input type="url" value={form.issueUrl} onChange={(e) => updateForm({ issueUrl: e.target.value })} className={inputClass} placeholder="https://github.com/owner/repo/issues/123" />
        {errors.issueUrl && <p className="mt-1 text-xs text-red-500">{errors.issueUrl}</p>}
      </div>
    </div>
  );
}

function Step3({ form, errors, updateForm }: { form: FormState; errors: Record<string, string>; updateForm: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Stake & Slots</h2>
      </div>
      <p className="text-sm text-muted-foreground">Set your stake, max workers, deadline and CI requirement.</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Stake (token)</label>
          <input type="number" min="0.01" step="0.01" value={form.stake} onChange={(e) => updateForm({ stake: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.1" />
          {errors.stake && <p className="mt-1 text-xs text-red-500">{errors.stake}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Max Slots</label>
          <input type="number" min="1" max="20" value={form.maxSlots} onChange={(e) => updateForm({ maxSlots: parseInt(e.target.value) || 1 })} className={inputClass} />
          {errors.maxSlots && <p className="mt-1 text-xs text-red-500">{errors.maxSlots}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Deadline (days)</label>
        <input type="number" min="1" max="14" value={form.deadlineDays} onChange={(e) => updateForm({ deadlineDays: parseInt(e.target.value) || 7 })} className={inputClass} />
        {errors.deadlineDays && <p className="mt-1 text-xs text-red-500">{errors.deadlineDays}</p>}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border p-4">
        <input type="checkbox" id="ci" checked={form.ciRequired} onChange={(e) => updateForm({ ciRequired: e.target.checked })} className="h-5 w-5 rounded accent-primary" />
        <label htmlFor="ci" className="text-sm font-medium">Require CI to pass before winner eligibility</label>
      </div>
    </div>
  );
}

function Step4({ form, errors, updateForm }: { form: FormState; errors: Record<string, string>; updateForm: (p: Partial<FormState>) => void }) {
  const amountFormatted = form.amount.toFixed(form.token === "USDC" ? 2 : 4);
  const stakeFormatted = form.stake.toFixed(4);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Review & Confirm</h2>
      </div>
      <p className="text-sm text-muted-foreground">Review your bounty details before posting.</p>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <ReviewRow label="Token" value={form.token} />
        <ReviewRow label="Reward Amount" value={`${amountFormatted} ${form.token}`} />
        <ReviewRow label="Repository" value={form.repoUrl} />
        <ReviewRow label="Issue" value={form.issueUrl} />
        <ReviewRow label="Stake Required" value={`${stakeFormatted} ${form.token}`} />
        <ReviewRow label="Max Workers" value={String(form.maxSlots)} />
        <ReviewRow label="Deadline" value={`${form.deadlineDays} days`} />
        <ReviewRow label="CI Required" value={form.ciRequired ? "Yes" : "No"} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border p-4">
        <input type="checkbox" id="confirm" checked={form.confirmed} onChange={(e) => updateForm({ confirmed: e.target.checked })} className="h-5 w-5 rounded accent-primary" />
        <label htmlFor="confirm" className="text-sm font-medium">
          I confirm the details above and approve the transaction
        </label>
      </div>
      {errors.confirmed && <p className="text-xs text-red-500">{errors.confirmed}</p>}

      <p className="text-xs text-muted-foreground">
        By posting, you approve <strong>{amountFormatted} {form.token}</strong> and stake <strong>{stakeFormatted} {form.token}</strong> (refundable when bounty resolves).
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}