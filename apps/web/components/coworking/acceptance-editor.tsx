"use client";

import * as React from "react";
import { Check, Plus, ThumbsUp, Trash2, X } from "lucide-react";
import type {
  AcceptanceCriterionInput,
  DoDItemInput,
  Member,
  ReviewVerdict,
  Task,
  TaskReview,
} from "@yeheskieltame/claudelance-coworking-sdk";

import { Button } from "@/components/ui/button";

import { Input, Spinner } from "./ui";

/**
 * Editable list of acceptance-criteria rows. Operates on the SDK input shape
 * (`AcceptanceCriterionInput[]`) so it feeds straight into createTask/updateTask.
 * Each row toggles rule|scenario, edits text + optional evidence URL, and marks
 * done. Shows X/Y progress.
 */
export function AcceptanceCriteriaEditor({
  value,
  onChange,
  disabled,
}: {
  value: AcceptanceCriterionInput[];
  onChange: (next: AcceptanceCriterionInput[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<AcceptanceCriterionInput>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, { kind: "rule", text: "", done: false }]);

  const done = value.filter((row) => row.done).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Acceptance criteria</span>
        <span className="text-xs text-muted-foreground">
          {done}/{value.length} done
        </span>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No criteria yet. Add the conditions that mark this task complete.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((row, index) => (
            <li key={index} className="rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  aria-label="Done"
                  disabled={disabled}
                  checked={Boolean(row.done)}
                  onChange={(e) => update(index, { done: e.target.checked })}
                  className="mt-2 h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <select
                      aria-label="Criterion kind"
                      disabled={disabled}
                      value={row.kind ?? "rule"}
                      onChange={(e) =>
                        update(index, { kind: e.target.value as "rule" | "scenario" })
                      }
                      className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <option value="rule">Rule</option>
                      <option value="scenario">Scenario</option>
                    </select>
                    <Input
                      className="h-9 flex-1 text-sm"
                      disabled={disabled}
                      value={row.text}
                      placeholder={
                        (row.kind ?? "rule") === "scenario"
                          ? "Given … when … then …"
                          : "The condition that must hold"
                      }
                      onChange={(e) => update(index, { text: e.target.value })}
                    />
                  </div>
                  <Input
                    className="h-9 text-xs"
                    disabled={disabled}
                    value={row.evidenceUrl ?? ""}
                    placeholder="Evidence URL (optional)"
                    onChange={(e) =>
                      update(index, { evidenceUrl: e.target.value || undefined })
                    }
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove criterion"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  className="mt-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={add}
        className="h-9 px-3 text-xs"
      >
        <Plus className="h-3.5 w-3.5" /> Add criterion
      </Button>
    </div>
  );
}

/**
 * Definition-of-Done checklist: lighter-weight than acceptance criteria - just
 * `{ text, done }` items with add/remove/check. Operates on the SDK
 * `DoDItemInput[]` shape.
 */
export function DoDChecklist({
  value,
  onChange,
  disabled,
}: {
  value: DoDItemInput[];
  onChange: (next: DoDItemInput[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<DoDItemInput>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, { text: "", done: false }]);

  const done = value.filter((row) => row.done).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Definition of Done</span>
        <span className="text-xs text-muted-foreground">
          {done}/{value.length} done
        </span>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">No checklist items yet.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((row, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Done"
                disabled={disabled}
                checked={Boolean(row.done)}
                onChange={(e) => update(index, { done: e.target.checked })}
                className="h-4 w-4 shrink-0 rounded border-border accent-primary"
              />
              <Input
                className="h-9 flex-1 text-sm"
                disabled={disabled}
                value={row.text}
                placeholder="Checklist item"
                onChange={(e) => update(index, { text: e.target.value })}
              />
              <button
                type="button"
                aria-label="Remove item"
                disabled={disabled}
                onClick={() => remove(index)}
                className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={add}
        className="h-9 px-3 text-xs"
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </Button>
    </div>
  );
}

const VERDICT_LABEL: Record<ReviewVerdict, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

/**
 * Review-loop controls for a single task. The parent owns the mutations and
 * passes them as callbacks; this component only renders the reviewer picker +
 * the request/approve/request-changes/reject buttons and surfaces the current
 * reviewer + latest verdict.
 */
export function ReviewControls({
  task,
  members,
  currentMemberId,
  latestReview,
  onRequestReview,
  onSubmitReview,
  pending,
  disabled,
}: {
  task: Task;
  members: Member[];
  currentMemberId?: string | null;
  /** The most recent review verdict on this task, if any. */
  latestReview?: TaskReview | null;
  /** Move into review with the chosen reviewer (undefined = server resolves). */
  onRequestReview: (reviewerMemberId?: string) => void;
  /** Record a verdict (optionally with a comment). */
  onSubmitReview: (input: { verdict: ReviewVerdict; comment?: string }) => void;
  /** True while any review mutation is in flight. */
  pending?: boolean;
  disabled?: boolean;
}) {
  const [reviewerId, setReviewerId] = React.useState<string>(task.reviewerMemberId ?? "");
  const [comment, setComment] = React.useState("");

  const memberName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.id, m.displayName);
    return map;
  }, [members]);

  const currentReviewer = task.reviewerMemberId
    ? memberName.get(task.reviewerMemberId) ?? "assigned"
    : null;
  // The reviewer the current member can act as is whoever is on the task; gate
  // the verdict buttons when the current member isn't that reviewer.
  const isReviewer = Boolean(
    currentMemberId && task.reviewerMemberId && currentMemberId === task.reviewerMemberId,
  );
  const blocked = Boolean(disabled || pending);

  const submit = (verdict: ReviewVerdict) =>
    onSubmitReview({ verdict, comment: comment.trim() || undefined });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Review</span>
        {pending ? <Spinner /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Reviewer:{" "}
          <span className="text-foreground">{currentReviewer ?? "unassigned"}</span>
        </span>
        {latestReview ? (
          <span>
            · Latest:{" "}
            <span className="text-foreground">{VERDICT_LABEL[latestReview.verdict]}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1">
          <label
            htmlFor={`reviewer-${task.id}`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Pick reviewer
          </label>
          <select
            id={`reviewer-${task.id}`}
            value={reviewerId}
            disabled={blocked}
            onChange={(e) => setReviewerId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">Auto (assignee)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked}
          onClick={() => onRequestReview(reviewerId || undefined)}
          className="h-9 px-3 text-xs"
        >
          Request review
        </Button>
      </div>

      <Input
        className="h-9 text-xs"
        disabled={blocked}
        value={comment}
        placeholder="Verdict comment (optional)"
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={blocked || !isReviewer}
          onClick={() => submit("approved")}
          className="h-9 px-3 text-xs"
          title={isReviewer ? undefined : "Only the assigned reviewer can record a verdict"}
        >
          <ThumbsUp className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked || !isReviewer}
          onClick={() => submit("changes_requested")}
          className="h-9 px-3 text-xs"
        >
          <Check className="h-3.5 w-3.5" /> Request changes
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked || !isReviewer}
          onClick={() => submit("rejected")}
          className="h-9 px-3 text-xs text-destructive hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    </div>
  );
}
