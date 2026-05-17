"use client";

import * as React from "react";

export type PostBountyState = {
  // Step 1
  token: "cUSD" | "CELO" | "USDC";
  amount: string;
  // Step 2
  repoUrl: string;
  issueUrl: string;
  // Step 3
  stake: string;
  maxSlots: string;
  deadlineDays: string;
  ciRequired: boolean;
};

const initialState: PostBountyState = {
  token: "CELO",
  amount: "",
  repoUrl: "",
  issueUrl: "",
  stake: "0.1",
  maxSlots: "5",
  deadlineDays: "7",
  ciRequired: true,
};

export function usePostBountyForm() {
  const [step, setStep] = React.useState(1);
  const [data, setData] = React.useState<PostBountyState>(initialState);
  const [errors, setErrors] = React.useState<Partial<Record<keyof PostBountyState, string>>>({});

  const totalSteps = 4;

  const update = (patch: Partial<PostBountyState>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const validateStep = (s: number): boolean => {
    setErrors({});
    if (s === 1) {
      const errs: typeof errors = {};
      if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) <= 0) {
        errs.amount = "Enter a valid amount greater than 0";
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return false;
      }
    }
    if (s === 2) {
      const errs: typeof errors = {};
      if (!data.repoUrl || !data.repoUrl.startsWith("https://github.com/")) {
        errs.repoUrl = "Enter a valid GitHub repo URL";
      }
      if (!data.issueUrl || !data.issueUrl.startsWith("https://github.com/")) {
        errs.issueUrl = "Enter a valid GitHub issue URL";
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return false;
      }
    }
    if (s === 3) {
      const errs: typeof errors = {};
      if (!data.stake || isNaN(Number(data.stake)) || Number(data.stake) <= 0) {
        errs.stake = "Stake must be greater than 0";
      }
      if (!data.maxSlots || isNaN(Number(data.maxSlots)) || Number(data.maxSlots) < 1) {
        errs.maxSlots = "At least 1 slot required";
      }
      if (!data.deadlineDays || isNaN(Number(data.deadlineDays)) || Number(data.deadlineDays) < 1) {
        errs.deadlineDays = "Deadline must be at least 1 day";
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, totalSteps));
    }
  };

  const back = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const reset = () => {
    setStep(1);
    setData(initialState);
    setErrors({});
  };

  return { step, totalSteps, data, errors, update, next, back, reset, validateStep };
}