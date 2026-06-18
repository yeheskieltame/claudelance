"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2, MessageSquare, Plus, UserPlus } from "lucide-react";
import type { StatusColumn, Task } from "@yeheskieltame/claudelance-coworking-sdk";

import { Button } from "@/components/ui/button";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { cwKeys } from "@/lib/coworking";

import { ActivityFeed } from "./activity-feed";
import { useCoworking } from "./provider";
import { EmptyState, Input, PriorityDot, Spinner, timeAgo } from "./ui";

export function Board({ projectId }: { projectId: string }) {
  const { client, apiKey } = useCoworking();
  const qc = useQueryClient();
  const enabled = Boolean(apiKey);

  const project = useQuery({ queryKey: cwKeys.project(projectId), queryFn: () => client.getProject(projectId), enabled });
  const columns = useQuery({ queryKey: cwKeys.columns(projectId), queryFn: () => client.listColumns(projectId), enabled });
  const tasks = useQuery({
    queryKey: cwKeys.tasks(projectId),
    queryFn: () => client.listTasks({ projectId, limit: 200 }),
    enabled,
    refetchInterval: 6000,
  });
  const members = useQuery({ queryKey: cwKeys.members, queryFn: () => client.listMembers(), enabled });

  const [title, setTitle] = React.useState("");
  const createTask = useMutation({
    mutationFn: () => client.createTask({ projectId, title: title.trim() }),
    onSuccess: () => {
      setTitle("");
      invalidate();
    },
  });

  const invalidate = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: cwKeys.tasks(projectId) });
    qc.invalidateQueries({ queryKey: cwKeys.activity(projectId) });
  }, [qc, projectId]);

  const memberName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members.data?.items ?? []) map.set(m.id, m.displayName);
    return map;
  }, [members.data]);

  const cols = React.useMemo(
    () => [...(columns.data?.items ?? [])].sort((a, b) => a.position - b.position),
    [columns.data],
  );
  const byColumn = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const c of cols) map.set(c.id, []);
    for (const t of tasks.data?.items ?? []) map.get(t.statusColumnId)?.push(t);
    return map;
  }, [cols, tasks.data]);

  if (!enabled) {
    return <EmptyState title="Not connected" hint="Open Coworking and connect a workspace key first." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/coworking" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-scale-5 font-bold tracking-tight">{project.data?.name ?? "Project"}</h1>
          <div className="flex items-center gap-3">
            {project.data ? (
              <span className="font-mono text-xs text-muted-foreground">{project.data.key}</span>
            ) : null}
            {project.data?.linkedBountyId ? (
              <Link
                href={`/bounty/${project.data.linkedBountyId}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Link2 className="h-3 w-3" /> Bounty #{project.data.linkedBountyId}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <GlassCard className="p-4 sm:p-5">
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) createTask.mutate();
          }}
        >
          <Input
            className="min-w-48 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New task title"
            maxLength={300}
          />
          <Button type="submit" disabled={!title.trim() || createTask.isPending}>
            {createTask.isPending ? <Spinner /> : <Plus className="h-4 w-4" />} Add task
          </Button>
        </form>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          {columns.isLoading || tasks.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {cols.map((col) => {
                const colTasks = byColumn.get(col.id) ?? [];
                return (
                  <div key={col.id} className="w-72 shrink-0">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-sm font-medium">{col.name}</span>
                      <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          columns={cols}
                          memberName={memberName}
                          onChanged={invalidate}
                        />
                      ))}
                      {colTasks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
                          empty
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <GlassCard className="p-5 sm:p-6">
            <CardTitle>Activity</CardTitle>
            <div className="mt-3">
              <ActivityFeed projectId={projectId} />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  columns,
  memberName,
  onChanged,
}: {
  task: Task;
  columns: StatusColumn[];
  memberName: Map<string, string>;
  onChanged: () => void;
}) {
  const { client } = useCoworking();
  const [open, setOpen] = React.useState(false);

  const move = useMutation({ mutationFn: (key: string) => client.updateTaskStatus(task.id, key), onSuccess: onChanged });
  const claim = useMutation({ mutationFn: () => client.claimTask(task.id), onSuccess: onChanged });

  const currentCol = columns.find((c) => c.id === task.statusColumnId);
  const assignee = task.assigneeMemberId ? memberName.get(task.assigneeMemberId) ?? "assigned" : null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="mt-1.5">
          <PriorityDot priority={task.priority} />
        </span>
        <p className="flex-1 text-sm font-medium leading-snug">{task.title}</p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">#{task.number}</span>
        {assignee ? <span className="truncate">· {assignee}</span> : null}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-foreground"
          aria-label="Comments"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={currentCol?.key ?? ""}
          onChange={(e) => move.mutate(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {columns.map((c) => (
            <option key={c.id} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
        {!task.assigneeMemberId ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => claim.mutate()}
            disabled={claim.isPending}
          >
            <UserPlus className="h-3.5 w-3.5" /> Claim
          </Button>
        ) : null}
      </div>
      {open ? <TaskComments taskId={task.id} /> : null}
    </div>
  );
}

function TaskComments({ taskId }: { taskId: string }) {
  const { client } = useCoworking();
  const qc = useQueryClient();
  const comments = useQuery({ queryKey: cwKeys.comments(taskId), queryFn: () => client.listComments(taskId) });
  const [body, setBody] = React.useState("");
  const add = useMutation({
    mutationFn: () => client.addComment(taskId, body.trim()),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: cwKeys.comments(taskId) });
    },
  });

  const items = comments.data?.items ?? [];

  return (
    <div className="mt-3 border-t border-border pt-3">
      {comments.isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((cm) => (
            <li key={cm.id} className="text-xs text-muted-foreground">
              <span className="text-foreground">{cm.body}</span>{" "}
              <span className="text-muted-foreground/60">· {timeAgo(cm.createdAt)}</span>
            </li>
          ))}
          {items.length === 0 ? <li className="text-xs text-muted-foreground">No comments yet.</li> : null}
        </ul>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <Input
          className="h-8 text-xs"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Comment…"
        />
        <Button type="submit" size="sm" className="h-8 px-2 text-xs" disabled={!body.trim() || add.isPending}>
          Send
        </Button>
      </form>
    </div>
  );
}
