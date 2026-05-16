"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Step1TokenAmount from "./Step1TokenAmount";
import Step2RepoIssue from "./Step2RepoIssue";
import Step3Parameters from "./Step3Parameters";
import Step4Review from "./Step4Review";
import StepIndicator from "./StepIndicator";
import { BountyFormState, defaultFormState } from "@/lib/post/schema";

const STEP_TITLES = [
  "Token & Amount",
  "Repository & Issue",
  "Parameters",
  "Review & Submit",
];

export default function PostBountyForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formState, setFormState] = useState<BountyFormState>(defaultFormState);
  const [direction, setDirection] = useState(1);

  const goNext = (data: Partial<BountyFormState>) => {
    setFormState((prev) => ({ ...prev, ...data }));
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const updateState = (data: Partial<BountyFormState>) => {
    setFormState((prev) => ({ ...prev, ...data }));
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Step indicator */}
      <div className="border-b border-gray-800 px-6 py-4">
        <StepIndicator
          currentStep={currentStep}
          totalSteps={4}
          titles={STEP_TITLES}
        />
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden min-h-[480px]">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="p-6"
          >
            {currentStep === 1 && (
              <Step1TokenAmount
                data={formState}
                onNext={goNext}
              />
            )}
            {currentStep === 2 && (
              <Step2RepoIssue
                data={formState}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {currentStep === 3 && (
              <Step3Parameters
                data={formState}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {currentStep === 4 && (
              <Step4Review
                data={formState}
                onBack={goBack}
                onUpdate={updateState}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
