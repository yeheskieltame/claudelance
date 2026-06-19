"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, Check, ChevronDown, Copy, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle, GlassCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ConnectAgentProps {
  apiUrl: string;
  apiKey: string;
  projectId: string;
  projectKey: string;
  projectName: string;
}

type TabId = "prompt" | "mcp";

/** Masked stand-in for the key in the DISPLAYED text. Copy always uses the real key. */
const MASKED_KEY = "cwk_••••••••••••";

/**
 * Build the "paste into any agent" orchestrator brief. `key` is the value that
 * appears in the rendered text - either the real key or {@link MASKED_KEY}; the
 * copy path always passes the real key so what lands on the clipboard is usable.
 */
function buildPromptBlock(p: ConnectAgentProps, key: string): string {
  const { apiUrl, projectId, projectKey, projectName } = p;
  return `You are an orchestrator coordinating a team of AI agents. Your shared workspace, task board, and team memory is **Claudelance Coworking** — an agent-native project & task coordination API. Use it for ALL task tracking and team coordination.

CONNECTION
- Base URL: ${apiUrl}
- Auth (every request): header  Authorization: Bearer ${key}
- Project: "${projectName}"  (key ${projectKey}, id ${projectId})
- All requests/responses are JSON. Identify yourself first: GET /v1/me.

CORE LOOP (REST)
1. Pick work: GET /v1/projects/${projectId}/next  → highest-priority UNBLOCKED tasks. (Your open tasks: GET /v1/me/tasks · what's blocking you: GET /v1/me/blocked)
2. Claim it BEFORE working: POST /v1/tasks/{id}/claim   (so two agents never duplicate work)
3. Move it across the board as you go: POST /v1/tasks/{id}/status {"statusColumnKey":"in_progress"}  (columns: backlog → todo → in_progress → in_review → done; canceled)
4. Post progress: POST /v1/tasks/{id}/comments {"body":"..."}
5. When the task's acceptanceCriteria are all met: POST /v1/tasks/{id}/request-review {"reviewerMemberId":"..."}  — reviewer then POST /v1/tasks/{id}/review {"verdict":"approved"} (or "changes_requested" / "rejected"). Only mark done after approval.

PLAN & DELEGATE
- Break the goal into tasks: POST /v1/tasks {"projectId":"${projectId}","title":"...","description":"...","type":"code|content|design|research|event|...","acceptanceCriteria":[{"kind":"rule","text":"..."}],"priority":2}
- Members/agents: GET /v1/members  (assign with POST /v1/tasks/{id}/assign {"memberId":"..."} or set assignee/reviewer on create)
- Dependencies: POST /v1/tasks/{id}/dependencies {"blockerTaskId":"..."}  → keeps whats_next/blocked accurate.

RULES FOR MULTI-AGENT TEAMWORK
1. Always claim before working. 2. One assignee + one reviewer per task. 3. Post progress as comments and move the card across the board. 4. Check /v1/me/blocked before starting; don't start blocked work. 5. Define acceptance criteria so "done" is objective; request review when they're met. 6. Use whats_next to always pick the most valuable unblocked task.

START NOW: GET /v1/me, then GET /v1/projects/${projectId}/next, then claim and execute the top task.`;
}

/** Build the MCP (Claude Code) connect + brief block. See {@link buildPromptBlock} for the `key` contract. */
function buildMcpBlock(p: ConnectAgentProps, key: string): string {
  const { apiUrl, projectId, projectName } = p;
  return `# 1) Connect Claudelance Coworking as an MCP server (run once in your terminal):
claude mcp add --transport http claudelance-coworking ${apiUrl}/mcp --header "Authorization: Bearer ${key}"

# 2) Then give your orchestrator agent this brief:
You coordinate a team of AI agents using Claudelance Coworking (project "${projectName}", id ${projectId}) as your shared task board + memory, via its MCP tools.
Tools: whats_next, my_open_tasks, whats_blocking_me, list_tasks, get_task, create_task, claim_task, assign_task, update_task_status, add_comment, add_dependency, request_review, submit_review, list_members, list_templates, create_task_from_template.
Loop: call whats_next (project ${projectId}) to pick the highest-priority unblocked task → claim_task → do the work → add_comment with progress → update_task_status across the board (backlog→todo→in_progress→in_review→done) → when acceptance criteria are met, request_review (or submit_review if you are the reviewer).
Rules: always claim before working so agents don't collide; one assignee + one reviewer per task; post progress as comments; check whats_blocking_me before starting; define acceptance criteria so "done" is objective.
Start: call whats_next for project ${projectId}, then claim and execute.`;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "prompt", label: "Prompt (any agent)" },
  { id: "mcp", label: "MCP (Claude Code)" },
];

/**
 * Collapsible "Connect an AI agent" card for a project board. Renders a ready
 * to paste orchestrator brief (REST prompt or MCP setup) carrying the live
 * workspace credentials, so an agent immediately understands Coworking and
 * starts coordinating. Client-only; the key never leaves the browser and is
 * never logged.
 */
export function ConnectAgent(props: ConnectAgentProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<TabId>("prompt");
  const [showKey, setShowKey] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const builder = tab === "prompt" ? buildPromptBlock : buildMcpBlock;
  // Real block (always copied) vs displayed block (key masked when hidden).
  const realBlock = builder(props, props.apiKey);
  const shownBlock = showKey ? realBlock : builder(props, MASKED_KEY);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(realBlock);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context / denied permission); fail
      // quietly rather than crash. Never surface the key in an error.
    }
  }, [realBlock]);

  return (
    <GlassCard className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="connect-agent-panel"
        className="flex w-full items-center gap-3 rounded-2xl p-4 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <CardTitle className="text-base">Connect an AI agent</CardTitle>
          <CardDescription className="mt-0.5">
            Copy this into your orchestrator agent — it&apos;ll understand Coworking and start
            coordinating your team.
          </CardDescription>
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="connect-agent-panel"
            key="panel"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border p-4 sm:p-5">
              <div
                className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
                role="tablist"
                aria-label="Connection method"
              >
                {TABS.map((t) => {
                  const active = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <pre
                  tabIndex={0}
                  aria-label={`${tab === "prompt" ? "Prompt" : "MCP"} block for your agent`}
                  className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/30 p-4 pr-14 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {shownBlock}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  aria-label={copied ? "Copied to clipboard" : "Copy block to clipboard"}
                  className="absolute right-2 top-2 h-8 gap-1.5 px-2.5 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <p className="flex-1 text-xs text-amber-700 dark:text-amber-300">
                  This includes your workspace API key — only paste it into an agent you trust.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKey((s) => !s)}
                  aria-pressed={showKey}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  className="h-8 shrink-0 gap-1.5 px-2.5 text-xs text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  {showKey ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide key
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden /> Show key
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </GlassCard>
  );
}
