"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import {
  CoworkingApiError,
  type MemberRole,
  type Project,
  type ResetPreview,
  type ResetResult,
} from "@yeheskieltame/claudelance-coworking-sdk";

import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle, GlassCard } from "@/components/ui/card";
import { cwKeys } from "@/lib/coworking";

import { useCoworking } from "./provider";
import { Input, Spinner } from "./ui";

// Roles allowed to run destructive resets (server enforces admin+ via 403; this
// mirrors it for UX so non-admins see a disabled panel rather than a failed call).
const RESET_ROLES: MemberRole[] = ["admin", "owner"];

/** The destructive action a confirmation modal is gathering consent for. */
type ResetAction =
  | { kind: "project"; project: Project }
  | { kind: "workspace" }
  | { kind: "demo" };

/**
 * Map a CoworkingApiError to a human-friendly message + whether the user must
 * re-run the preview to get a fresh token. The reset handshake fails with:
 *   409 reset_counts_changed / reset_scope_mismatch / idempotency_key_conflict /
 *       project_already_trashed / workspace_not_empty
 *   410 reset_token_consumed
 *   422 reset_token_expired
 */
function describeResetError(err: unknown): { message: string; rePreview: boolean } {
  if (err instanceof CoworkingApiError) {
    switch (err.code) {
      case "reset_counts_changed":
        return {
          message: "The workspace changed since the preview. Re-run the preview to see fresh counts.",
          rePreview: true,
        };
      case "reset_scope_mismatch":
        return {
          message: "That confirmation no longer matches this target. Start the preview again.",
          rePreview: true,
        };
      case "reset_token_consumed":
        return {
          message: "This confirmation was already used. Re-run the preview to try again.",
          rePreview: true,
        };
      case "reset_token_expired":
        return {
          message: "The confirmation window expired. Re-run the preview to get a new one.",
          rePreview: true,
        };
      case "idempotency_key_conflict":
        return {
          message: "A different request reused this key. Re-run the preview and confirm again.",
          rePreview: true,
        };
      case "project_already_trashed":
        return { message: "This project is already in the trash. Restore it first.", rePreview: false };
      case "workspace_not_empty":
        return { message: "The workspace already has projects, so the demo seed was skipped.", rePreview: false };
      default:
        break;
    }
    if (err.status === 403) {
      return {
        message: "Resets need an admin or owner key. This action is disabled for your role.",
        rePreview: false,
      };
    }
    return { message: err.message, rePreview: err.status === 409 || err.status === 410 || err.status === 422 };
  }
  return {
    message: err instanceof Error ? err.message : "Something went wrong. Try again.",
    rePreview: false,
  };
}

/** A single counts map rendered as a compact list of "12 tasks" rows. */
function CountsList({ counts, verb }: { counts: Record<string, number>; verb: string }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing to {verb}.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map(([key, n]) => (
        <li
          key={key}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <span className="font-semibold tabular-nums text-foreground">{n}</span>{" "}
          <span className="text-muted-foreground">{key}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Confirmation modal for a destructive reset / demo seed. Runs the PREVIEW on
 * open, renders the willDelete (or "will create") counts + what is preserved,
 * makes the user type an exact phrase, then commits with the preview token +
 * a fresh idempotency key. Maps 409/410/422 to friendly copy with a re-preview.
 */
function ResetModal({
  action,
  onClose,
}: {
  action: ResetAction;
  onClose: () => void;
}) {
  const { client } = useCoworking();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const dialogRef = React.useRef<HTMLDivElement>(null);

  const [typed, setTyped] = React.useState("");
  const [restoreColumns, setRestoreColumns] = React.useState(true);

  const isSeed = action.kind === "demo";
  const phrase =
    action.kind === "project"
      ? action.project.key
      : action.kind === "workspace"
        ? "CLEAR"
        : "SEED";
  const phraseMatches = typed.trim() === phrase;

  const title =
    action.kind === "project"
      ? `Reset project ${action.project.key}`
      : action.kind === "workspace"
        ? "Clear workspace"
        : "Seed demo data";

  // PREVIEW (dry-run) - re-runnable so a 409/410/422 on commit can be recovered.
  const preview = useMutation<ResetPreview, unknown, void>({
    mutationFn: () => {
      if (action.kind === "project") return client.previewProjectReset(action.project.id);
      if (action.kind === "workspace") return client.previewWorkspaceClear();
      return client.previewSeedDemo();
    },
  });

  // Run the preview once when the modal mounts.
  React.useEffect(() => {
    preview.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape + trap initial focus, mirroring the task-detail drawer.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled])')
      ?.focus();
  }, []);

  const commit = useMutation<ResetResult, unknown, void>({
    mutationFn: () => {
      const token = preview.data?.confirmationToken;
      if (!token) throw new Error("Run the preview first.");
      const idempotencyKey = crypto.randomUUID();
      if (action.kind === "project") {
        return client.commitProjectReset(action.project.id, {
          confirmationToken: token,
          confirm: true,
          idempotencyKey,
          restoreDefaultColumns: restoreColumns,
        });
      }
      if (action.kind === "workspace") {
        return client.commitWorkspaceClear({ confirmationToken: token, confirm: true, idempotencyKey });
      }
      return client.commitSeedDemo({ confirmationToken: token, confirm: true, idempotencyKey });
    },
    onSuccess: () => {
      // Everything could have changed - blow away the coworking cache.
      qc.invalidateQueries({ queryKey: ["coworking"] });
    },
  });

  const committed = commit.isSuccess;
  const commitError = commit.isError ? describeResetError(commit.error) : null;

  const counts = preview.data?.counts ?? {};
  const expiresAt = preview.data?.expiresAt;

  return (
    <AnimatePresence>
      <motion.div
        key="reset-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
        initial={reduceMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          ref={dialogRef}
          className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <span
                className={
                  "flex h-9 w-9 items-center justify-center rounded-full " +
                  (isSeed ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")
                }
                aria-hidden
              >
                {isSeed ? <Sparkles className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </span>
              <h2 className="font-display text-scale-4 font-semibold leading-tight">{title}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4 px-5 py-5">
            {committed ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {isSeed ? "Demo data seeded." : "Done."}
                </p>
                <CountsList counts={commit.data?.counts ?? {}} verb={isSeed ? "create" : "remove"} />
                {!isSeed ? (
                  <p className="text-xs text-muted-foreground">
                    Items went to the trash and are recoverable.
                  </p>
                ) : null}
                <div className="flex justify-end pt-1">
                  <Button onClick={onClose}>Close</Button>
                </div>
              </div>
            ) : preview.isPending ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner /> Checking what this affects…
              </div>
            ) : preview.isError ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{describeResetError(preview.error).message}</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
                    <RotateCcw className="h-4 w-4" /> Retry
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {isSeed ? "This will create:" : "This will move to trash:"}
                  </p>
                  <CountsList counts={counts} verb={isSeed ? "create" : "remove"} />
                </div>

                {!isSeed ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Preserved:</span> members, API keys, and
                    premium status are never touched. Trashed items are recoverable.
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Creates a sample project with tasks, dependencies, and a goal. Nothing is deleted.
                  </p>
                )}

                {action.kind === "project" ? (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={restoreColumns}
                      onChange={(e) => setRestoreColumns(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    Rebuild the board to the default columns
                  </label>
                ) : null}

                <div className="space-y-1.5">
                  <label htmlFor="reset-confirm" className="block text-xs font-medium text-muted-foreground">
                    Type <span className="font-mono font-semibold text-foreground">{phrase}</span> to confirm
                  </label>
                  <Input
                    id="reset-confirm"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={phrase}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby={expiresAt ? "reset-expiry" : undefined}
                  />
                  {expiresAt ? (
                    <p id="reset-expiry" className="text-[11px] text-muted-foreground">
                      Confirmation valid until {new Date(expiresAt).toLocaleTimeString()}.
                    </p>
                  ) : null}
                </div>

                {commitError ? (
                  <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
                    <p className="text-sm text-destructive">{commitError.message}</p>
                    {commitError.rePreview ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          setTyped("");
                          commit.reset();
                          preview.mutate();
                        }}
                        disabled={preview.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Re-run preview
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant={isSeed ? "primary" : "secondary"}
                    onClick={() => commit.mutate()}
                    disabled={!phraseMatches || commit.isPending || !preview.data}
                    className={
                      isSeed ? undefined : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    }
                  >
                    {commit.isPending ? (
                      <Spinner />
                    ) : isSeed ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {isSeed ? "Seed demo" : action.kind === "workspace" ? "Clear workspace" : "Reset project"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Danger Zone for a workspace: reset a single project, clear the whole
 * workspace, or seed demo data into an empty one. Each destructive action runs a
 * dry-run preview, requires the user to type an exact phrase, then commits with
 * the preview token + a fresh idempotency key (recoverable soft-delete).
 *
 * The panel is disabled when `workspace.allowReset === false` or the caller's
 * role is below admin. The server independently enforces admin role + admin
 * scope + allowReset, so a stale role prop can never escalate privilege.
 */
export function ResetPanel({
  allowReset,
  role,
}: {
  /** From getWorkspace(); when false the whole panel is disabled. */
  allowReset: boolean;
  /** Caller's workspace role, when known. Below-admin disables the actions. */
  role?: MemberRole | null;
}) {
  const { client, apiKey } = useCoworking();
  const enabled = Boolean(apiKey);

  const projects = useQuery({
    queryKey: cwKeys.projects,
    queryFn: () => client.listProjects(),
    enabled,
  });

  const [action, setAction] = React.useState<ResetAction | null>(null);
  const [projectId, setProjectId] = React.useState("");

  const projectItems = projects.data?.items ?? [];
  const workspaceEmpty = !projects.isLoading && projectItems.length === 0;
  // Only gate on role when we actually know it; otherwise defer to the server 403.
  const roleAllows = role == null || RESET_ROLES.includes(role);
  const disabled = !allowReset || !roleAllows;

  const selectedProject = projectItems.find((p) => p.id === projectId);

  return (
    <GlassCard className="border-destructive/30 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </div>
      <CardDescription className="mt-1">
        Destructive actions on this workspace. Items are soft-deleted to trash and remain recoverable.
      </CardDescription>

      {!allowReset ? (
        <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
          Resets are disabled for this workspace. Ask the owner to enable them in workspace settings.
        </p>
      ) : !roleAllows ? (
        <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
          Only admins and owners can run resets. Your role does not have access.
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {/* Reset a single project. */}
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Reset a project</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Trash all tasks, comments, and dependencies in one project. The project itself is kept.
            </p>
            <div className="mt-3 max-w-xs space-y-1">
              <label htmlFor="reset-project" className="block text-xs font-medium text-muted-foreground">
                Project
              </label>
              <select
                id="reset-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={disabled || projectItems.length === 0}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">Select a project…</option>
                {projectItems.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={disabled || !selectedProject}
            onClick={() => selectedProject && setAction({ kind: "project", project: selectedProject })}
          >
            <RotateCcw className="h-4 w-4" /> Reset project
          </Button>
        </div>

        {/* Clear the entire workspace. */}
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Clear workspace</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Trash every project and task. Members, API keys, and premium status are preserved.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={disabled}
            onClick={() => setAction({ kind: "workspace" })}
          >
            <Trash2 className="h-4 w-4" /> Clear workspace
          </Button>
        </div>

        {/* Seed demo data - only when the workspace is empty. */}
        {workspaceEmpty ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Seed demo data</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Populate an empty workspace with a sample project, tasks, dependencies, and a goal.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => setAction({ kind: "demo" })}
            >
              <Sparkles className="h-4 w-4" /> Seed demo
            </Button>
          </div>
        ) : null}
      </div>

      {action ? <ResetModal action={action} onClose={() => setAction(null)} /> : null}
    </GlassCard>
  );
}
