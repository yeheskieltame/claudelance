"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, GitBranch, Link2, MessageSquare, Plus, Save, X } from "lucide-react";
import {
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
  type AcceptanceCriterion,
  type AcceptanceCriterionInput,
  type DoDItemInput,
  type Label,
  type Member,
  type ReviewVerdict,
  type StatusColumn,
  type Task,
  type TaskPriority,
  type TaskReview,
  type TaskType,
} from "@yeheskieltame/claudelance-coworking-sdk";

import { Button } from "@/components/ui/button";
import { cwKeys } from "@/lib/coworking";
import { cn } from "@/lib/utils";

import { AcceptanceCriteriaEditor, DoDChecklist, ReviewControls } from "./acceptance-editor";
import { useCoworking } from "./provider";
import { PerTypeFields, TaskTypePicker } from "./task-fields";
import { Input, Spinner, Textarea, timeAgo } from "./ui";

const PRIORITIES: TaskPriority[] = [0, 1, 2, 3, 4];

/**
 * Task detail drawer - the centerpiece edit view (FE3). Mounted by the board with
 * `{ taskId, projectId, onClose }`. Slides over from the right on desktop and
 * fills the screen on mobile; closes on Escape, backdrop click, or the close
 * button, and traps focus inside while open.
 *
 * Loads the task + columns + members + reviews + watchers + the project task list
 * (for subtasks/dependencies), then lets the user edit every v2 field (title,
 * description, type + per-type fields, priority, assignee, dates, estimates,
 * labels, acceptance criteria, DoD), drive the review loop, manage watchers and
 * dependencies, move status, and comment. Edits to the core fields are batched
 * behind an explicit Save (updateTask + setTaskLabels); the review/watcher/
 * dependency/status/comment actions persist immediately. Relevant cwKeys are
 * invalidated after each mutation.
 */
export function TaskDetail({
  taskId,
  projectId,
  onClose,
}: {
  taskId: string;
  projectId?: string;
  onClose: () => void;
}) {
  const { client, apiKey } = useCoworking();
  const reduceMotion = useReducedMotion();
  const enabled = Boolean(apiKey);

  const task = useQuery({ queryKey: cwKeys.task(taskId), queryFn: () => client.getTask(taskId), enabled });
  const resolvedProjectId = projectId ?? task.data?.projectId;

  const columns = useQuery({
    queryKey: cwKeys.columns(resolvedProjectId ?? ""),
    queryFn: () => client.listColumns(resolvedProjectId as string),
    enabled: enabled && Boolean(resolvedProjectId),
  });
  const members = useQuery({ queryKey: cwKeys.members, queryFn: () => client.listMembers(), enabled });
  const labels = useQuery({
    queryKey: cwKeys.labels(resolvedProjectId ?? ""),
    queryFn: () => client.listLabels(resolvedProjectId as string),
    enabled: enabled && Boolean(resolvedProjectId),
  });
  // Sibling tasks in the same project power the subtask + dependency pickers.
  const projectTasks = useQuery({
    queryKey: cwKeys.tasks(resolvedProjectId ?? ""),
    queryFn: () => client.listTasks({ projectId: resolvedProjectId as string, limit: 200 }),
    enabled: enabled && Boolean(resolvedProjectId),
  });

  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Close on Escape; trap Tab focus inside the drawer while it is open.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move initial focus into the drawer when it opens, and restore focus to the
  // element that triggered it (e.g. the task card) when it closes.
  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const focusable = root?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    focusable?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const memberName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members.data?.items ?? []) map.set(m.id, m.displayName);
    return map;
  }, [members.data]);

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Task detail"
        onClick={onClose}
        initial={reduceMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          ref={dialogRef}
          className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          initial={reduceMotion ? undefined : { x: "100%" }}
          animate={{ x: 0 }}
          exit={reduceMotion ? undefined : { x: "100%" }}
          transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              {task.data ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">#{task.data.number}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      {TASK_TYPE_LABELS[task.data.type]}
                    </span>
                  </div>
                  <h2 className="mt-1 truncate font-display text-scale-4 font-semibold leading-snug">
                    {task.data.title}
                  </h2>
                </>
              ) : (
                <h2 className="font-display text-scale-4 font-semibold">Task</h2>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-6 px-5 py-5 sm:px-6">
            {task.isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner className="h-5 w-5" />
              </div>
            ) : task.isError || !task.data ? (
              <p className="text-sm text-destructive">
                {task.error instanceof Error ? task.error.message : "Could not load task."}
              </p>
            ) : (
              <TaskDetailBody
                task={task.data}
                projectId={resolvedProjectId}
                columns={[...(columns.data?.items ?? [])].sort((a, b) => a.position - b.position)}
                members={members.data?.items ?? []}
                labels={labels.data?.items ?? []}
                projectTasks={projectTasks.data?.items ?? []}
                memberName={memberName}
                onClose={onClose}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TaskDetailBody({
  task,
  projectId,
  columns,
  members,
  labels,
  projectTasks,
  memberName,
  onClose,
}: {
  task: Task;
  projectId?: string;
  columns: StatusColumn[];
  members: Member[];
  labels: Label[];
  projectTasks: Task[];
  memberName: Map<string, string>;
  onClose: () => void;
}) {
  const { client } = useCoworking();
  const qc = useQueryClient();

  // ---- Editable core fields (explicit Save) ---------------------------------
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [type, setType] = React.useState<TaskType>(task.type);
  const [fields, setFields] = React.useState<Record<string, unknown>>(task.fields ?? {});
  const [priority, setPriority] = React.useState<TaskPriority>(task.priority);
  const [assigneeMemberId, setAssigneeMemberId] = React.useState(task.assigneeMemberId ?? "");
  const [startDate, setStartDate] = React.useState(toDateInput(task.startDate));
  const [dueDate, setDueDate] = React.useState(toDateInput(task.dueDate));
  const [estimateMinutes, setEstimateMinutes] = React.useState(
    task.estimateMinutes == null ? "" : String(task.estimateMinutes),
  );
  const [estimatePoints, setEstimatePoints] = React.useState(
    task.estimatePoints == null ? "" : String(task.estimatePoints),
  );
  const [acceptanceCriteria, setAcceptanceCriteria] = React.useState<AcceptanceCriterionInput[]>(() =>
    toAcInput(task.acceptanceCriteria),
  );
  const [definitionOfDone, setDefinitionOfDone] = React.useState<DoDItemInput[]>(() =>
    toDoDInput(task.definitionOfDone),
  );
  const [labelIds, setLabelIds] = React.useState<string[]>(() => (task.labels ?? []).map((l) => l.id));
  const [newLabel, setNewLabel] = React.useState("");

  // Re-seed editor state when the underlying task changes (e.g. after a mutation
  // refetch or when a different task is opened into the same drawer instance).
  React.useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setType(task.type);
    setFields(task.fields ?? {});
    setPriority(task.priority);
    setAssigneeMemberId(task.assigneeMemberId ?? "");
    setStartDate(toDateInput(task.startDate));
    setDueDate(toDateInput(task.dueDate));
    setEstimateMinutes(task.estimateMinutes == null ? "" : String(task.estimateMinutes));
    setEstimatePoints(task.estimatePoints == null ? "" : String(task.estimatePoints));
    setAcceptanceCriteria(toAcInput(task.acceptanceCriteria));
    setDefinitionOfDone(toDoDInput(task.definitionOfDone));
    setLabelIds((task.labels ?? []).map((l) => l.id));
  }, [task]);

  const invalidateTask = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: cwKeys.task(task.id) });
    if (projectId) {
      qc.invalidateQueries({ queryKey: cwKeys.tasks(projectId) });
      qc.invalidateQueries({ queryKey: cwKeys.activity(projectId) });
    }
  }, [qc, task.id, projectId]);

  const originalLabelIds = React.useMemo(
    () => (task.labels ?? []).map((l) => l.id),
    [task.labels],
  );
  const labelsDirty = React.useMemo(() => {
    if (labelIds.length !== originalLabelIds.length) return true;
    const a = [...labelIds].sort();
    const b = [...originalLabelIds].sort();
    return a.some((id, i) => id !== b[i]);
  }, [labelIds, originalLabelIds]);

  const save = useMutation({
    mutationFn: async () => {
      const minutes = estimateMinutes.trim() === "" ? null : Number(estimateMinutes);
      const points = estimatePoints.trim() === "" ? null : Number(estimatePoints);
      const cleanFields = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined && v !== ""),
      );
      const ac = acceptanceCriteria
        .filter((row) => row.text.trim() !== "")
        .map((row) => ({ ...row, text: row.text.trim() }));
      const dod = definitionOfDone
        .filter((row) => row.text.trim() !== "")
        .map((row) => ({ ...row, text: row.text.trim() }));
      await client.updateTask(task.id, {
        title: title.trim() || task.title,
        description: description.trim() === "" ? null : description.trim(),
        type,
        fields: Object.keys(cleanFields).length > 0 ? cleanFields : null,
        priority,
        startDate: toIsoOrNull(startDate),
        dueDate: toIsoOrNull(dueDate),
        estimateMinutes: minutes != null && Number.isFinite(minutes) ? minutes : null,
        estimatePoints: points != null && Number.isFinite(points) ? points : null,
        acceptanceCriteria: ac,
        definitionOfDone: dod,
      });
      // Labels live on a dedicated PUT; only call it when the set actually changed.
      if (labelsDirty) await client.setTaskLabels(task.id, labelIds);
    },
    onSuccess: invalidateTask,
  });

  // Assignee is changed through its own endpoint (assign / claim), not updateTask.
  const assign = useMutation({
    mutationFn: (memberId: string) =>
      memberId ? client.assignTask(task.id, memberId) : client.claimTask(task.id),
    onSuccess: invalidateTask,
  });

  const createLabel = useMutation({
    mutationFn: () => client.createLabel(projectId as string, { name: newLabel.trim() }),
    onSuccess: (label) => {
      setNewLabel("");
      setLabelIds((ids) => [...ids, label.id]);
      if (projectId) qc.invalidateQueries({ queryKey: cwKeys.labels(projectId) });
    },
  });

  const move = useMutation({
    mutationFn: (key: string) => client.updateTaskStatus(task.id, key),
    onSuccess: invalidateTask,
  });

  const toggleLabel = (id: string) =>
    setLabelIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const currentColumn = columns.find((c) => c.id === task.statusColumnId);
  const parent = task.parentTaskId ? projectTasks.find((t) => t.id === task.parentTaskId) ?? null : null;
  const children = projectTasks.filter((t) => t.parentTaskId === task.id);

  return (
    <>
      {/* Status move ----------------------------------------------------------- */}
      {columns.length > 0 ? (
        <section className="space-y-2">
          <SectionLabel>Status</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((col) => {
              const active = col.id === task.statusColumnId;
              return (
                <Button
                  key={col.id}
                  type="button"
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  className="h-8 px-3 text-xs"
                  disabled={move.isPending || active}
                  aria-pressed={active}
                  onClick={() => move.mutate(col.key)}
                >
                  {col.name}
                </Button>
              );
            })}
            {move.isPending ? <Spinner className="self-center" /> : null}
          </div>
          {currentColumn ? (
            <p className="text-xs text-muted-foreground">
              In <span className="text-foreground">{currentColumn.name}</span>
            </p>
          ) : null}
          {move.isError ? <ErrorText error={move.error} fallback="Could not move task." /> : null}
        </section>
      ) : null}

      {/* Core fields ----------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Details</SectionLabel>
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Spinner /> : <Save className="h-3.5 w-3.5" />} Save
          </Button>
        </div>

        <div className="space-y-1">
          <label htmlFor="detail-title" className="block text-xs font-medium text-muted-foreground">
            Title
          </label>
          <Input
            id="detail-title"
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="detail-description" className="block text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            id="detail-description"
            className="min-h-28"
            value={description}
            maxLength={20000}
            placeholder="Markdown supported"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="detail-type" className="block text-xs font-medium text-muted-foreground">
              Type
            </label>
            <TaskTypePicker id="detail-type" value={type} onChange={setType} />
          </div>
          <div className="space-y-1">
            <label htmlFor="detail-priority" className="block text-xs font-medium text-muted-foreground">
              Priority
            </label>
            <select
              id="detail-priority"
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

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="detail-start" className="block text-xs font-medium text-muted-foreground">
              Start date
            </label>
            <Input id="detail-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="detail-due" className="block text-xs font-medium text-muted-foreground">
              Due date
            </label>
            <Input id="detail-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="detail-min" className="block text-xs font-medium text-muted-foreground">
                Est. min
              </label>
              <Input
                id="detail-min"
                inputMode="numeric"
                value={estimateMinutes}
                placeholder="60"
                onChange={(e) => setEstimateMinutes(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="detail-pts" className="block text-xs font-medium text-muted-foreground">
                Points
              </label>
              <Input
                id="detail-pts"
                inputMode="decimal"
                value={estimatePoints}
                placeholder="3"
                onChange={(e) => setEstimatePoints(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>
          </div>
        </div>

        {/* Assignee persists immediately via assign/claim. */}
        <div className="space-y-1">
          <label htmlFor="detail-assignee" className="block text-xs font-medium text-muted-foreground">
            Assignee
          </label>
          <div className="flex items-center gap-2">
            <select
              id="detail-assignee"
              value={assigneeMemberId}
              disabled={assign.isPending}
              onChange={(e) => {
                const next = e.target.value;
                setAssigneeMemberId(next);
                assign.mutate(next);
              }}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
            {assign.isPending ? <Spinner /> : null}
          </div>
          {assign.isError ? <ErrorText error={assign.error} fallback="Could not change assignee." /> : null}
        </div>

        {/* Labels (saved with the Details Save, via setTaskLabels). */}
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
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
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
          {projectId ? (
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
                {createLabel.isPending ? <Spinner /> : <Plus className="h-3.5 w-3.5" />} Add
              </Button>
            </div>
          ) : null}
          {labelsDirty ? (
            <p className="text-xs text-muted-foreground">Label changes apply when you Save.</p>
          ) : null}
        </div>

        {save.isError ? <ErrorText error={save.error} fallback="Could not save task." /> : null}
      </section>

      {/* Acceptance criteria + DoD -------------------------------------------- */}
      <section className="space-y-4 border-t border-border pt-5">
        <AcceptanceCriteriaEditor value={acceptanceCriteria} onChange={setAcceptanceCriteria} />
        <DoDChecklist value={definitionOfDone} onChange={setDefinitionOfDone} />
        <p className="text-xs text-muted-foreground">
          Acceptance criteria and the Definition of Done apply when you Save.
        </p>
      </section>

      {/* Review loop ----------------------------------------------------------- */}
      <section className="space-y-3 border-t border-border pt-5">
        <SectionLabel>Review</SectionLabel>
        <ReviewSection task={task} members={members} onChanged={invalidateTask} />
      </section>

      {/* Watchers -------------------------------------------------------------- */}
      <section className="space-y-3 border-t border-border pt-5">
        <SectionLabel>Watchers</SectionLabel>
        <WatchersSection taskId={task.id} memberName={memberName} />
      </section>

      {/* Subtasks + dependencies ---------------------------------------------- */}
      <section className="space-y-4 border-t border-border pt-5">
        <SectionLabel>Relationships</SectionLabel>
        <SubtasksView parent={parent} children={children} />
        <DependenciesSection
          task={task}
          projectTasks={projectTasks}
          memberName={memberName}
          onChanged={invalidateTask}
        />
      </section>

      {/* Comments -------------------------------------------------------------- */}
      <section className="space-y-3 border-t border-border pt-5">
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Comments
          </span>
        </SectionLabel>
        <CommentsThread taskId={task.id} />
      </section>
    </>
  );
}

// ---- Review ----------------------------------------------------------------

const VERDICT_LABEL: Record<ReviewVerdict, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

function ReviewSection({
  task,
  members,
  onChanged,
}: {
  task: Task;
  members: Member[];
  onChanged: () => void;
}) {
  const { client, apiKey } = useCoworking();
  const qc = useQueryClient();

  const reviews = useQuery({
    queryKey: cwKeys.reviews(task.id),
    queryFn: () => client.listReviews(task.id),
    enabled: Boolean(apiKey),
  });
  // The reviewer inbox tells us whether the current member is THIS task's
  // pending reviewer - the only client-side signal for "can I record a verdict"
  // (there is no whoami endpoint). When the task is in my inbox, open the gate.
  const myReviews = useQuery({
    queryKey: cwKeys.myReviews,
    queryFn: () => client.myReviews(),
    enabled: Boolean(apiKey),
  });
  const isMyReview = (myReviews.data?.items ?? []).some((t) => t.id === task.id);
  const currentMemberId = isMyReview ? task.reviewerMemberId : null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: cwKeys.reviews(task.id) });
    qc.invalidateQueries({ queryKey: cwKeys.myReviews });
    onChanged();
  };

  const requestReview = useMutation({
    mutationFn: (reviewerMemberId?: string) => client.requestReview(task.id, reviewerMemberId),
    onSuccess: invalidate,
  });
  const submitReview = useMutation({
    mutationFn: (input: { verdict: ReviewVerdict; comment?: string }) =>
      client.submitReview(task.id, input),
    onSuccess: invalidate,
  });

  const items = reviews.data?.items ?? [];
  const latest: TaskReview | null = items.length > 0 ? items[items.length - 1]! : null;
  const error = requestReview.error ?? submitReview.error;

  return (
    <div className="space-y-3">
      <ReviewControls
        task={task}
        members={members}
        currentMemberId={currentMemberId}
        latestReview={latest}
        onRequestReview={(reviewerMemberId) => requestReview.mutate(reviewerMemberId)}
        onSubmitReview={(input) => submitReview.mutate(input)}
        pending={requestReview.isPending || submitReview.isPending}
      />

      {error ? <ErrorText error={error} fallback="Review action failed." /> : null}

      {reviews.isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-1.5">
          {[...items].reverse().map((r) => (
            <li key={r.id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{VERDICT_LABEL[r.verdict]}</span>
              {r.comment ? <span> — {r.comment}</span> : null}
              <span className="text-muted-foreground/60"> · {timeAgo(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No reviews yet.</p>
      )}
    </div>
  );
}

// ---- Watchers --------------------------------------------------------------

function WatchersSection({
  taskId,
  memberName,
}: {
  taskId: string;
  memberName: Map<string, string>;
}) {
  const { client, apiKey } = useCoworking();
  const qc = useQueryClient();

  const watchers = useQuery({
    queryKey: cwKeys.watchers(taskId),
    queryFn: () => client.listWatchers(taskId),
    enabled: Boolean(apiKey),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: cwKeys.watchers(taskId) });

  // addWatcher() with no memberId defaults to the calling member server-side.
  const watchSelf = useMutation({ mutationFn: () => client.addWatcher(taskId), onSuccess: invalidate });
  const removeWatcher = useMutation({
    mutationFn: (memberId: string) => client.removeWatcher(taskId, memberId),
    onSuccess: invalidate,
  });

  const items = watchers.data?.items ?? [];
  const error = watchSelf.error ?? removeWatcher.error;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {items.length === 0
            ? "No watchers"
            : `${items.length} watching`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          disabled={watchSelf.isPending}
          onClick={() => watchSelf.mutate()}
        >
          {watchSelf.isPending ? <Spinner /> : <Eye className="h-3.5 w-3.5" />} Watch
        </Button>
      </div>
      {watchers.isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((w) => (
            <li
              key={w.memberId}
              className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span className="truncate text-foreground">{memberName.get(w.memberId) ?? w.memberId}</span>
              <button
                type="button"
                aria-label={`Stop ${memberName.get(w.memberId) ?? "member"} watching`}
                disabled={removeWatcher.isPending}
                onClick={() => removeWatcher.mutate(w.memberId)}
                className="inline-flex items-center gap-1 transition-colors hover:text-destructive disabled:opacity-50"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <ErrorText error={error} fallback="Could not update watchers." /> : null}
    </div>
  );
}

// ---- Subtasks --------------------------------------------------------------

function SubtasksView({ parent, children }: { parent: Task | null; children: Task[] }) {
  if (!parent && children.length === 0) {
    return <p className="text-xs text-muted-foreground">No parent or subtasks.</p>;
  }
  return (
    <div className="space-y-2">
      {parent ? (
        <div className="text-xs">
          <span className="text-muted-foreground">Parent: </span>
          <span className="font-mono text-muted-foreground">#{parent.number}</span>{" "}
          <span className="text-foreground">{parent.title}</span>
        </div>
      ) : null}
      {children.length > 0 ? (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Subtasks ({children.length})</span>
          <ul className="space-y-1">
            {children.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">#{c.number}</span>
                <span className="truncate text-foreground">{c.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---- Dependencies ----------------------------------------------------------

function DependenciesSection({
  task,
  projectTasks,
  memberName,
  onChanged,
}: {
  task: Task;
  projectTasks: Task[];
  memberName: Map<string, string>;
  onChanged: () => void;
}) {
  const { client, apiKey } = useCoworking();
  const qc = useQueryClient();
  const [blockerId, setBlockerId] = React.useState("");

  // There is no task-scoped dependency list endpoint; the member-scoped
  // "what's blocking me" view is the read we have, so surface this task's known
  // blockers from it when present.
  const blocking = useQuery({
    queryKey: ["coworking", "blocking-me"] as const,
    queryFn: () => client.whatsBlockingMe(),
    enabled: Boolean(apiKey),
  });
  const blockers =
    (blocking.data?.items ?? []).find((entry) => entry.task.id === task.id)?.blockers ?? [];

  const addDependency = useMutation({
    mutationFn: (id: string) => client.addDependency(task.id, id),
    onSuccess: () => {
      setBlockerId("");
      qc.invalidateQueries({ queryKey: ["coworking", "blocking-me"] });
      onChanged();
    },
  });

  // Candidate blockers: any other task in the project not already a known blocker.
  const candidates = projectTasks.filter(
    (t) => t.id !== task.id && !blockers.some((b) => b.id === t.id),
  );

  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground">Blocked by</span>
      {blockers.length > 0 ? (
        <ul className="space-y-1">
          {blockers.map((b) => (
            <li key={b.id} className="flex items-center gap-2 text-xs">
              <GitBranch className="h-3 w-3 text-amber-600" aria-hidden />
              <span className="font-mono text-muted-foreground">#{b.number}</span>
              <span className="truncate text-foreground">{b.title}</span>
              {b.assigneeMemberId ? (
                <span className="text-muted-foreground/70">· {memberName.get(b.assigneeMemberId) ?? "assigned"}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Not blocked.</p>
      )}

      {candidates.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={blockerId}
            onChange={(e) => setBlockerId(e.target.value)}
            aria-label="Add a blocking task"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Add a blocker…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.number} {t.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs"
            disabled={!blockerId || addDependency.isPending}
            onClick={() => blockerId && addDependency.mutate(blockerId)}
          >
            {addDependency.isPending ? <Spinner /> : <Link2 className="h-3.5 w-3.5" />} Add
          </Button>
        </div>
      ) : null}
      {addDependency.isError ? (
        <ErrorText error={addDependency.error} fallback="Could not add dependency." />
      ) : null}
    </div>
  );
}

// ---- Comments --------------------------------------------------------------

function CommentsThread({ taskId }: { taskId: string }) {
  const { client, apiKey } = useCoworking();
  const qc = useQueryClient();
  const comments = useQuery({
    queryKey: cwKeys.comments(taskId),
    queryFn: () => client.listComments(taskId),
    enabled: Boolean(apiKey),
  });
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
    <div className="space-y-2">
      {comments.isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((cm) => (
            <li key={cm.id} className="text-xs text-muted-foreground">
              <span className="whitespace-pre-wrap text-foreground">{cm.body}</span>{" "}
              <span className="text-muted-foreground/60">· {timeAgo(cm.createdAt)}</span>
            </li>
          ))}
          {items.length === 0 ? <li className="text-xs text-muted-foreground">No comments yet.</li> : null}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <Input
          className="h-9 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
        />
        <Button type="submit" size="sm" className="h-9 px-3 text-xs" disabled={!body.trim() || add.isPending}>
          {add.isPending ? <Spinner /> : "Send"}
        </Button>
      </form>
      {add.isError ? <ErrorText error={add.error} fallback="Could not add comment." /> : null}
    </div>
  );
}

// ---- Small shared bits -----------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

function ErrorText({ error, fallback }: { error: unknown; fallback: string }) {
  return <p className="text-sm text-destructive">{error instanceof Error ? error.message : fallback}</p>;
}

/** ISO timestamp -> yyyy-mm-dd for a <input type="date">; "" when null/invalid. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * <input type="date"> value ("yyyy-mm-dd") -> full ISO-8601 datetime, or null
 * when cleared. The PATCH endpoint validates startDate/dueDate with
 * z.string().datetime() and 400s on a date-only string; null clears the field.
 */
function toIsoOrNull(d: string): string | null {
  return d ? new Date(`${d}T00:00:00.000Z`).toISOString() : null;
}

/**
 * Map stored acceptance criteria into the editor input shape. Carries through the
 * audit metadata (evidenceHash, checkedBy, checkedAt) as well as the editable
 * fields: the save mutation always re-sends the full acceptanceCriteria array and
 * the backend PATCH does a FULL replace, so dropping these here would erase the
 * audit trail on already-checked criteria whenever any field is edited.
 */
function toAcInput(rows: AcceptanceCriterion[]): AcceptanceCriterionInput[] {
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    text: r.text,
    done: r.done,
    verification: r.verification,
    evidenceUrl: r.evidenceUrl,
    evidenceHash: r.evidenceHash,
    checkedBy: r.checkedBy,
    checkedAt: r.checkedAt,
  }));
}

/** Map stored DoD items (with ids + done) into the editor input shape. */
function toDoDInput(rows: { id: string; text: string; done: boolean }[]): DoDItemInput[] {
  return rows.map((r) => ({ id: r.id, text: r.text, done: r.done }));
}
