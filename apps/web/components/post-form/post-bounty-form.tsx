"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { usePostBountyForm } from "./use-post-bounty-form";
import { StepOne, StepTwo, StepThree, StepFour } from "./steps";

const STEP_LABELS = [
  "Token & Amount",
  "Repository & Issue",
  "Stake & Settings",
  "Review & Confirm",
] as const;

export function PostBountyForm() {
  const { step, totalSteps, data, errors, update, next, back, reset } = usePostBountyForm();

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24">
      {/* Progress bar */}
      <div className="mb-8 flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={n} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "border-2 border-primary text-primary"
                    : "border-2 border-border text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              {n < totalSteps && (
                <div
                  className={`h-0.5 flex-1 transition-colors ${
                    done ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step label */}
      <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
        Step {step} of {totalSteps} — {STEP_LABELS[step - 1]}
      </p>

      {/* Step content */}
      <GlassCard className="mb-6 !p-6">
        {step === 1 && <StepOne data={data} errors={errors} update={update} />}
        {step === 2 && <StepTwo data={data} errors={errors} update={update} />}
        {step === 3 && <StepThree data={data} errors={errors} update={update} />}
        {step === 4 && <StepFour data={data} />}
      </GlassCard>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="glass" onClick={back} className="flex-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        {step < totalSteps ? (
          <Button onClick={next} className="flex-1">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={reset} className="flex-1">
            <Check className="h-4 w-4" />
            Post Bounty
          </Button>
        )}
      </div>
    </div>
  );
}