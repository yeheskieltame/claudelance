"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Coins, GitPullRequest } from "lucide-react";
import Link from "next/link";

const STEPS = ["Token & Amount", "Details", "Review", "Confirm"];
const TOKENS = [
  { symbol: "cUSD", label: "cUSD", color: "emerald" },
  { symbol: "CELO", label: "CELO", color: "amber" },
  { symbol: "USDC", label: "USDC", color: "sky" },
];

export default function PostBountyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("CELO");
  const [amount, setAmount] = useState("1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canNext = () => {
    if (step === 0) return token && Number(amount) > 0;
    if (step === 1) return title.trim().length > 0;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // Simulate tx
    await new Promise(r => setTimeout(r, 2000));
    setSubmitting(false);
    router.push("/bounties");
  };

  return (
    <main className="relative isolate min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40" />
      <Header />
      
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pt-10">
        <Link href="/bounties" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold">Post a Bounty</h1>
        <p className="mt-1 text-sm text-muted">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

        <div className="mt-6 flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium">Token</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {TOKENS.map(t => (
                    <button key={t.symbol} onClick={() => setToken(t.symbol)}
                      className={`rounded-xl border p-3 text-center text-sm font-medium transition ${
                        token === t.symbol ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Amount ({token})</label>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Build a DeFi dashboard widget"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  placeholder="Describe the task requirements..."
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none" />
              </div>
            </div>
          )}

          {step >= 2 && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Token</span>
                <span className="font-medium">{token}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Amount</span>
                <span className="font-medium flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> {amount} {token}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Title</span>
                <span className="font-medium text-right max-w-[200px] truncate">{title}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 3 ? (
            <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Posting..." : <><Check className="h-4 w-4 mr-1" /> Confirm & Post</>}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
