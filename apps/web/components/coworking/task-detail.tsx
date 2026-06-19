"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { TASK_TYPE_LABELS } from "@yeheskieltame/claudelance-coworking-sdk";

import { Button } from "@/components/ui/button";
import { cwKeys } from "@/lib/coworking";

import { useCoworking } from "./provider";
import { Spinner } from "./ui";

/**
 * Task detail panel. FE2 wires the board's `selectedTaskId` to mount this with
 * `{ taskId, onClose }`; FE3 owns the full editor (description, per-type fields,
 * acceptance criteria, DoD, review loop, watchers, labels). This is the agreed
 * seam: a minimal overlay that fetches and renders the task so the contract is
 * stable and the board flow is testable before FE3 lands.
 */
export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { client } = useCoworking();
  const task = useQuery({ queryKey: cwKeys.task(taskId), queryFn: () => client.getTask(taskId) });

  // Close on Escape for keyboard users.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/70 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Task detail"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {task.data ? (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">#{task.data.number}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {TASK_TYPE_LABELS[task.data.type]}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-scale-4 font-semibold leading-snug">{task.data.title}</h2>
              </>
            ) : (
              <h2 className="font-display text-scale-4 font-semibold">Task</h2>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4">
          {task.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-5 w-5" />
            </div>
          ) : task.isError ? (
            <p className="text-sm text-destructive">
              {task.error instanceof Error ? task.error.message : "Could not load task."}
            </p>
          ) : task.data?.description ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.data.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description.</p>
          )}
        </div>
      </div>
    </div>
  );
}
