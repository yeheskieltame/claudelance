"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Link2, MessageSquare, Plus, Tag, UserPlus } from "lucide-react";
import {
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
  type AcceptanceCriterionInput,
  type Label,
  type StatusColumn,
  type Task,
  type TaskPriority,
  type TaskType,
} from "@yeheskieltame/claudelance-coworking-sdk";

import { Button } from "@/components/ui/button";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { cwKeys } from "@/lib/coworking";

import { AcceptanceCriteriaEditor } from "./acceptance-editor";
import { ActivityFeed } from "./activity-feed";
import { useCoworking } from "./provider";
import { TaskDetail } from "./task-detail";
import { PerTypeFields, TaskTypePicker } from "./task-fields";
import { EmptyState, Input, PriorityDot, Spinner, Textarea, timeAgo } from "./ui";

const PRIORITIES: TaskPriority[] = [0, 1, 2, 3, 4];

/**
 * Convert a <input type="date"> value ("yyyy-mm-dd") into a full ISO-8601 datetime.
 * The backend validates startDate/dueDate with z.string().datetime() and rejects
 * date-only strings, so the bare input value must be widened before submit.
 */
const toIso = (d?: string) => (d ? new Date(`${d}T00:00:00.000Z`).toISOString() : undefined);

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
  const labels = useQuery({
    queryKey: cwKeys.labels(projectId),
    queryFn: () => client.listLabels(projectId),
    enabled,
  });

  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

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

      <CreateTaskForm
        projectId={projectId}
        members={members.data?.items ?? []}
        columns={cols}
        labels={labels.data?.items ?? []}
        onCreated={invalidate}
      />

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
                          onOpen={() => setSelectedTaskId(t.id)}
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

      {selectedTaskId ? (
        <TaskDetail taskId={selectedTaskId} projectId={projectId} onClose={() => setSelectedTaskId(null)} />
      ) : null}
    </div>
  );
}

/**
 * Rich, inline create form: a compact "quick add" row (title + add) that expands
 * via the "more" toggle to reveal the full v2 task fields - description, type +
 * per-type fields, priority, assignee/reviewer, dates, estimate, labels, and an
 * acceptance-criteria editor. On submit every provided field is sent to
 * createTask (not just the title).
 */
function CreateTaskForm({
  projectId,
  members,
  columns,
  labels,
  onCreated,
}: {
  projectId: string;
  members: { id: string; displayName: string }[];
  columns: StatusColumn[];
  labels: Label[];
  onCreated: () => void;
}) {
  const { client } = useCoworking();
  const qc = useQueryClient();

  const [expanded, setExpanded] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<TaskType>("generic");
  const [fields, setFields] = React.useState<Record<string, unknown>>({});
  const [priority, setPriority] = React.useState<TaskPriority>(0);
  const [assigneeMemberId, setAssigneeMemberId] = React.useState("");
  const [reviewerMemberId, setReviewerMemberId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [estimateMinutes, setEstimateMinutes] = React.useState("");
  const [statusColumnKey, setStatusColumnKey] = React.useState("");
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  const [acceptanceCriteria, setAcceptanceCriteria] = React.useState<AcceptanceCriterionInput[]>([]);
  const [newLabel, setNewLabel] = React.useState("");

  const reset = () => {
    setTitle("");
    setDescription("");
    setType("generic");
    setFields({});
    setPriority(0);
    setAssigneeMemberId("");
    setReviewerMemberId("");
    setStartDate("");
    setDueDate("");
    setEstimateMinutes("");
    setStatusColumnKey("");
    setLabelIds([]);
    setAcceptanceCriteria([]);
    setNewLabel("");
  };

  const create = useMutation({
    mutationFn: () => {
      const minutes = estimateMinutes.trim() === "" ? undefined : Number(estimateMinutes);
      const cleanFields = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined && v !== ""),
      );
      const ac = acceptanceCriteria.filter((row) => row.text.trim() !== "");
      return client.createTask({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        fields: Object.keys(cleanFields).length > 0 ? cleanFields : undefined,
        priority: priority || undefined,
        assigneeMemberId: assigneeMemberId || undefined,
        reviewerMemberId: reviewerMemberId || undefined,
        startDate: toIso(startDate || undefined),
        dueDate: toIso(dueDate || undefined),
        estimateMinutes: Number.isFinite(minutes) ? minutes : undefined,
        statusColumnKey: statusColumnKey || undefined,
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        acceptanceCriteria: ac.length > 0 ? ac : undefined,
      });
    },
    onSuccess: () => {
      reset();
      onCreated();
    },
  });

  const createLabel = useMutation({
    mutationFn: () => client.createLabel(projectId, { name: newLabel.trim() }),
    onSuccess: (label) => {
      setNewLabel("");
      setLabelIds((ids) => [...ids, label.id]);
      qc.invalidateQueries({ queryKey: cwKeys.labels(projectId) });
    },
  });

  const toggleLabel = (id: string) =>
    setLabelIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <GlassCard className="p-4 sm:p-5">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <div className="flex flex-wrap gap-3">
          <Input
            className="min-w-48 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New task title"
            maxLength={300}
            aria-label="Task title"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setExpanded((o) => !o)}
            aria-expanded={expanded}
            aria-controls="create-task-details"
          >
            <ChevronDown className={"h-4 w-4 transition-transform " + (expanded ? "rotate-180" : "")} />
            More
          </Button>
          <Button type="submit" disabled={!title.trim() || create.isPending}>
            {create.isPending ? <Spinner /> : <Plus className="h-4 w-4" />} Add task
          </Button>
        </div>

        {expanded ? (
          <div id="create-task-details" className="space-y-4 border-t border-border pt-4">
            <div className="space-y-1">
              <label htmlFor="create-description" className="block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                id="create-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What needs to happen?"
                maxLength={20000}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="create-type" className="block text-xs font-medium text-muted-foreground">
                  Type
                </label>
                <TaskTypePicker id="create-type" value={type} onChange={setType} />
              </div>
              <div className="space-y-1">
                <label htmlFor="create-priority" className="block text-xs font-medium text-muted-foreground">
                  Priority
                </label>
                <select
                  id="create-priority"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <PerTypeFields type={type} fields={fields} onChange={setFields} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="create-assignee" className="block text-xs font-medium text-muted-foreground">
                  Assignee
                </label>
                <select
                  id="create-assignee"
                  value={assigneeMemberId}
                  onChange={(e) => setAssigneeMemberId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="create-reviewer" className="block text-xs font-medium text-muted-foreground">
                  Reviewer
                </label>
                <select
                  id="create-reviewer"
                  value={reviewerMemberId}
                  onChange={(e) => setReviewerMemberId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No reviewer</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="create-start" className="block text-xs font-medium text-muted-foreground">
                  Start date
                </label>
                <Input
                  id="create-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="create-due" className="block text-xs font-medium text-muted-foreground">
                  Due date
                </label>
                <Input id="create-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="create-estimate" className="block text-xs font-medium text-muted-foreground">
                  Estimate (min)
                </label>
                <Input
                  id="create-estimate"
                  inputMode="numeric"
                  value={estimateMinutes}
                  placeholder="60"
                  onChange={(e) => setEstimateMinutes(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
            </div>

            {columns.length > 0 ? (
              <div className="space-y-1">
                <label htmlFor="create-column" className="block text-xs font-medium text-muted-foreground">
                  Start column
                </label>
                <select
                  id="create-column"
                  value={statusColumnKey}
                  onChange={(e) => setStatusColumnKey(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">First column (default)</option>
                  {columns.map((c) => (
                    <option key={c.id} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <span className="block text-xs font-medium text-muted-foreground">Labels</span>
              {labels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => {
                    const active = labelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(label.id)}
                        aria-pressed={active}
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors " +
                          (active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground")
                        }
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: label.color ?? "hsl(var(--muted-foreground))" }}
                          aria-hidden
                        />
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No labels yet. Create one below.</p>
              )}
              <div className="flex gap-2">
                <Input
                  className="h-9 flex-1 text-sm"
                  value={newLabel}
                  placeholder="New label name"
                  aria-label="New label name"
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newLabel.trim()) createLabel.mutate();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs"
                  disabled={!newLabel.trim() || createLabel.isPending}
                  onClick={() => createLabel.mutate()}
                >
                  {createLabel.isPending ? <Spinner /> : <Tag className="h-3.5 w-3.5" />} Add label
                </Button>
              </div>
            </div>

            <AcceptanceCriteriaEditor value={acceptanceCriteria} onChange={setAcceptanceCriteria} />
          </div>
        ) : null}

        {create.isError ? (
          <p className="text-sm text-destructive">
            {create.error instanceof Error ? create.error.message : "Could not create task."}
          </p>
        ) : null}
      </form>
    </GlassCard>
  );
}

function TaskCard({
  task,
  columns,
  memberName,
  onChanged,
  onOpen,
}: {
  task: Task;
  columns: StatusColumn[];
  memberName: Map<string, string>;
  onChanged: () => void;
  onOpen: () => void;
}) {
  const { client } = useCoworking();
  const [showComments, setShowComments] = React.useState(false);

  const move = useMutation({ mutationFn: (key: string) => client.updateTaskStatus(task.id, key), onSuccess: onChanged });
  const claim = useMutation({ mutationFn: () => client.claimTask(task.id), onSuccess: onChanged });

  const currentCol = columns.find((c) => c.id === task.statusColumnId);
  const assignee = task.assigneeMemberId ? memberName.get(task.assigneeMemberId) ?? "assigned" : null;
  const reviewer = task.reviewerMemberId ? memberName.get(task.reviewerMemberId) ?? "reviewer" : null;
  const labels = task.labels ?? [];
  const ac = task.acProgress;
  const acComplete = ac ? ac.total > 0 && ac.done >= ac.total : false;
  const due = dueState(task.dueDate);

  // Open detail when the card body is activated, but never when the user is
  // interacting with the inline controls (status select, claim, comments).
  const openFromKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={openFromKey}
        className="cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open task ${task.title}`}
      >
        <div className="flex items-start gap-2">
          <span className="mt-1.5">
            <PriorityDot priority={task.priority} />
          </span>
          <p className="flex-1 text-sm font-medium leading-snug">{task.title}</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {TASK_TYPE_LABELS[task.type]}
          </span>
          {labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: label.color ?? "hsl(var(--muted-foreground))" }}
                aria-hidden
              />
              {label.name}
            </span>
          ))}
        </div>

        {ac && ac.total > 0 ? (
          <div className="mt-2">
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
                (acComplete ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground")
              }
              title={`Acceptance criteria ${ac.done}/${ac.total} done`}
            >
              AC {ac.done}/{ac.total}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">#{task.number}</span>
        {assignee ? <span className="truncate">· {assignee}</span> : null}
        {reviewer ? (
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground"
            title={`Reviewer: ${reviewer}`}
            aria-label={`Reviewer ${reviewer}`}
          >
            {initials(reviewer)}
          </span>
        ) : null}
        {due ? (
          <span
            className={"ml-0.5 " + (due.overdue ? "text-destructive" : "text-amber-600")}
            title={due.overdue ? "Overdue" : "Due soon"}
          >
            {due.label}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setShowComments((o) => !o)}
          className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-foreground"
          aria-label="Comments"
          aria-expanded={showComments}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={currentCol?.key ?? ""}
          onChange={(e) => move.mutate(e.target.value)}
          aria-label="Move task"
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
      {showComments ? <TaskComments taskId={task.id} /> : null}
    </div>
  );
}

/** Relative due-date badge: only surfaces when the task is due soon or overdue. */
function dueState(iso: string | null): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return null;
  const diffMs = due - Date.now();
  const oneDay = 86_400_000;
  // Within ~3 days (or already past) is worth flagging on the card.
  if (diffMs > oneDay * 3) return null;
  if (diffMs < 0) {
    const days = Math.round(-diffMs / oneDay);
    return { label: days <= 0 ? "due today" : `${days}d overdue`, overdue: true };
  }
  const days = Math.round(diffMs / oneDay);
  return { label: days <= 0 ? "due today" : `due ${days}d`, overdue: false };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
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
