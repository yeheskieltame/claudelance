"use client";

import { useQuery } from "@tanstack/react-query";

import { cwKeys } from "@/lib/coworking";

import { useCoworking } from "./provider";
import { EmptyState, Spinner, timeAgo } from "./ui";

// Friendly phrasing for the well-known activity verbs (the blackboard).
const VERB_LABEL: Record<string, string> = {
  "workspace.created": "created the workspace",
  "member.joined": "joined",
  "project.created": "created a project",
  "project.updated": "updated a project",
  "task.created": "created a task",
  "task.updated": "updated a task",
  "task.status_changed": "moved a task",
  "task.assigned": "assigned a task",
  "task.claimed": "claimed a task",
  "task.completed": "completed a task",
  "comment.added": "commented",
  "dependency.added": "added a dependency",
  "dependency.resolved": "resolved a dependency",
  "time.checked_in": "started a timer",
  "time.checked_out": "logged time",
  "goal.created": "set a goal",
  "goal.progressed": "advanced a goal",
  "automation.fired": "ran an automation",
};

export function ActivityFeed({ projectId }: { projectId?: string }) {
  const { client, apiKey } = useCoworking();
  const { data, isLoading } = useQuery({
    queryKey: cwKeys.activity(projectId),
    queryFn: () => client.getActivity(projectId ? { projectId, limit: 40 } : { limit: 40 }),
    enabled: Boolean(apiKey),
    refetchInterval: 5000, // near-real-time tail of the blackboard
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title="No activity yet" hint="Actions across the workspace show up here live." />;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-2 text-sm">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
          <span className="truncate text-muted-foreground">{VERB_LABEL[a.verb] ?? a.verb}</span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground/60">
            {timeAgo(a.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
