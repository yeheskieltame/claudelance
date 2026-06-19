"use client";

import * as React from "react";
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskType,
} from "@yeheskieltame/claudelance-coworking-sdk";

import { Input } from "./ui";

/** A single advisory field rendered for a task type. */
type FieldKind = "text" | "number" | "bool";

interface FieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  kind?: FieldKind;
}

/**
 * Per-type advisory field hints. Data-driven so adding a type is a one-line map
 * entry. Keys mirror the well-known field bag the backend stores under
 * `task.fields` (any keys accepted, unknowns never rejected). Types not listed
 * fall back to `generic` (no extra fields).
 */
const PER_TYPE_FIELDS: Partial<Record<TaskType, FieldSpec[]>> = {
  code: [
    { key: "repoUrl", label: "Repo URL", placeholder: "https://github.com/owner/repo" },
    { key: "branch", label: "Branch", placeholder: "main" },
    { key: "prUrl", label: "PR URL", placeholder: "https://github.com/owner/repo/pull/123" },
    { key: "language", label: "Language", placeholder: "TypeScript" },
    { key: "testPlan", label: "Test plan", placeholder: "How the change is verified" },
  ],
  bug: [
    { key: "repoUrl", label: "Repo URL", placeholder: "https://github.com/owner/repo" },
    { key: "branch", label: "Branch", placeholder: "main" },
    { key: "prUrl", label: "PR URL", placeholder: "https://github.com/owner/repo/pull/123" },
    { key: "language", label: "Language", placeholder: "TypeScript" },
    { key: "testPlan", label: "Test plan", placeholder: "Steps to reproduce + verify" },
  ],
  content: [
    { key: "wordCount", label: "Word count", placeholder: "800", kind: "number" },
    { key: "tone", label: "Tone", placeholder: "Confident, technical" },
    { key: "channel", label: "Channel", placeholder: "Blog, X, newsletter" },
    { key: "seoKeywords", label: "SEO keywords", placeholder: "celo, agent payments" },
    { key: "cta", label: "Call to action", placeholder: "Sign up for early access" },
  ],
  marketing: [
    { key: "wordCount", label: "Word count", placeholder: "800", kind: "number" },
    { key: "tone", label: "Tone", placeholder: "Playful, urgent" },
    { key: "channel", label: "Channel", placeholder: "X, LinkedIn, email" },
    { key: "seoKeywords", label: "SEO keywords", placeholder: "onchain, AI labor" },
    { key: "cta", label: "Call to action", placeholder: "Book a demo" },
  ],
  design: [
    { key: "dimensions", label: "Dimensions", placeholder: "1200x630" },
    { key: "format", label: "Format", placeholder: "PNG, SVG, Figma" },
    { key: "brandAssetsRef", label: "Brand assets ref", placeholder: "Figma / drive link" },
  ],
  research: [
    {
      key: "researchQuestions",
      label: "Research questions",
      placeholder: "What are we trying to answer?",
    },
    { key: "sources", label: "Sources", placeholder: "Required sources / datasets" },
    { key: "deliverableFormat", label: "Deliverable format", placeholder: "Memo, slides, report" },
  ],
  doc_review: [
    {
      key: "researchQuestions",
      label: "Review questions",
      placeholder: "What should the review answer?",
    },
    { key: "sources", label: "Sources", placeholder: "Documents under review" },
    { key: "deliverableFormat", label: "Deliverable format", placeholder: "Annotated doc, memo" },
  ],
  data_analysis: [
    { key: "datasetRef", label: "Dataset ref", placeholder: "Link / table / query" },
    { key: "metric", label: "Metric", placeholder: "Conversion rate, retention" },
    { key: "hypothesis", label: "Hypothesis", placeholder: "What you expect to find" },
  ],
  finance: [
    { key: "datasetRef", label: "Dataset ref", placeholder: "Link / table / query" },
    { key: "metric", label: "Metric", placeholder: "Burn rate, runway" },
    { key: "hypothesis", label: "Hypothesis", placeholder: "What you expect to find" },
    {
      key: "disclaimerRequired",
      label: "Disclaimer required",
      kind: "bool",
    },
  ],
  event: [
    { key: "eventDate", label: "Event date", placeholder: "2026-07-01" },
    { key: "venue", label: "Venue", placeholder: "Online / location" },
    { key: "headcount", label: "Headcount", placeholder: "50", kind: "number" },
    { key: "budget", label: "Budget", placeholder: "5000", kind: "number" },
    { key: "vendors", label: "Vendors", placeholder: "Catering, A/V, …" },
  ],
  documentation: [
    { key: "docPath", label: "Doc path", placeholder: "docs/guide.md" },
    { key: "audience", label: "Audience", placeholder: "Developers, end users" },
  ],
  education: [
    { key: "docPath", label: "Doc path", placeholder: "docs/lesson.md" },
    { key: "audience", label: "Audience", placeholder: "Beginners, operators" },
  ],
  devops: [
    { key: "service", label: "Service", placeholder: "relayer, web" },
    { key: "environmentTarget", label: "Environment target", placeholder: "production, staging" },
    { key: "runbookRef", label: "Runbook ref", placeholder: "Link to runbook" },
  ],
  qa: [
    { key: "testScope", label: "Test scope", placeholder: "Checkout flow" },
    { key: "testType", label: "Test type", placeholder: "Manual, e2e, regression" },
    { key: "passCriteria", label: "Pass criteria", placeholder: "All paths green" },
  ],
  legal: [
    {
      key: "researchQuestions",
      label: "Legal questions",
      placeholder: "What should the review answer?",
    },
    { key: "sources", label: "Sources", placeholder: "Contracts, statutes, prior art" },
    { key: "deliverableFormat", label: "Deliverable format", placeholder: "Memo, redline" },
    {
      key: "disclaimerRequired",
      label: "Disclaimer required",
      kind: "bool",
    },
  ],
};

/** Select over the full task-type taxonomy, rendering human labels. */
export function TaskTypePicker({
  value,
  onChange,
  id,
  className,
  disabled,
}: {
  value: TaskType;
  onChange: (value: TaskType) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as TaskType)}
      className={
        "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" +
        (className ? ` ${className}` : "")
      }
    >
      {TASK_TYPES.map((t) => (
        <option key={t} value={t}>
          {TASK_TYPE_LABELS[t]}
        </option>
      ))}
    </select>
  );
}

/**
 * Renders the advisory inputs for the active task type into a `fields` bag.
 * Presentational: the parent owns the `fields` object and merges each change.
 * Returns null for types without a field spec (e.g. `generic`).
 */
export function PerTypeFields({
  type,
  fields,
  onChange,
  disabled,
}: {
  type: TaskType;
  fields: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const specs = PER_TYPE_FIELDS[type];
  if (!specs || specs.length === 0) return null;

  const set = (key: string, value: unknown) => onChange({ ...fields, [key]: value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {specs.map((spec) => {
        const fieldId = `field-${type}-${spec.key}`;
        if (spec.kind === "bool") {
          return (
            <label
              key={spec.key}
              htmlFor={fieldId}
              className="flex items-center gap-2 text-sm text-foreground sm:col-span-2"
            >
              <input
                id={fieldId}
                type="checkbox"
                disabled={disabled}
                checked={Boolean(fields[spec.key])}
                onChange={(e) => set(spec.key, e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {spec.label}
            </label>
          );
        }
        const raw = fields[spec.key];
        const stringValue =
          raw === undefined || raw === null ? "" : typeof raw === "string" ? raw : String(raw);
        return (
          <div key={spec.key} className="space-y-1">
            <label htmlFor={fieldId} className="block text-xs font-medium text-muted-foreground">
              {spec.label}
            </label>
            <Input
              id={fieldId}
              disabled={disabled}
              inputMode={spec.kind === "number" ? "numeric" : undefined}
              value={stringValue}
              placeholder={spec.placeholder}
              onChange={(e) => {
                const v = e.target.value;
                if (spec.kind === "number") {
                  set(spec.key, v === "" ? undefined : Number(v));
                } else {
                  set(spec.key, v === "" ? undefined : v);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
