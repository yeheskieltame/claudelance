// Autonomous (headless) worker loop. For unattended runs - the interactive path
// is the generated kit (workers/<role>/run.sh). One tick: find or claim a task in
// my expertise, mark it in_progress, run the work through `claude -p`, post the
// result as a comment, and request review. All state lives on the board, so the
// loop is stateless and a worker is fully independent.
//
// ponytail: plan-mode by default (the agent proposes; the review loop + a human
// gate the merge). --apply lets it edit files. No git-worktree isolation yet -
// run one --apply worker at a time, or add worktrees per role if you parallelize.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { CoworkingApi } from './api.js';
import { ROSTER, PROJECT } from './roster.js';
import { loadEnv, baseUrl, keyVar, REPO_ROOT, WORKSPACE_FILE, log } from './util.js';

function taskPrompt(def, task) {
  return `You are the ${def.displayName} on the Claudelance team (turf: ${def.focus}).
Work this task from the Coworking board:

  #${task.number} [${task.type}] ${task.title}
  ${task.description ?? ''}

Do the work in this repo on a branch named worker/${def.role}, per-file commits, English only.
End with a short summary of what you did (or, in plan mode, what you propose) and any branch/PR.`;
}

function runClaude(def, task, { apply }) {
  const args = ['-p', taskPrompt(def, task)];
  if (!apply) args.push('--permission-mode', 'plan');
  const r = spawnSync('claude', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.error) return { ok: false, summary: `${def.displayName}: could not run \`claude\` (${r.error.message}). Is the CLI installed?` };
  const out = (r.stdout || '').trim();
  return {
    ok: r.status === 0,
    summary: `**${def.displayName}** ${apply ? 'worked on' : 'planned'} #${task.number}:\n\n${out.slice(0, 6000) || '(no output)'}`,
  };
}

async function pickTask(api, def, projectId) {
  const mine = (await api.myOpenTasks()).filter((t) => t.projectId === projectId);
  if (mine.length) return mine[0];
  const next = await api.whatsNext(projectId);
  const cand = next.find((t) => def.taskTypes.includes(t.type)) ?? next[0];
  if (!cand) return null;
  try {
    return await api.claimTask(cand.id);
  } catch {
    return cand; // already claimed/assigned; work it anyway
  }
}

export async function runWorker(role, { once = false, apply = false, dry = false } = {}) {
  const def = ROSTER.find((r) => r.role === role);
  if (!def) throw new Error(`unknown role "${role}". Known: ${ROSTER.map((r) => r.role).join(', ')}`);

  const env = loadEnv();
  const key = env[keyVar(role)];
  if (!key) throw new Error(`no key for ${role} - run \`clw bootstrap\` first.`);
  const api = new CoworkingApi(baseUrl(env), key);

  const ws = existsSync(WORKSPACE_FILE) ? JSON.parse(readFileSync(WORKSPACE_FILE, 'utf8')) : null;
  const projectId = ws?.project?.id ?? (await api.listProjects()).find((p) => p.key === PROJECT.key)?.id;
  if (!projectId) throw new Error(`project ${PROJECT.key} not found - run \`clw bootstrap\`.`);
  const reviewerId = ws?.ownerMemberId;

  do {
    const task = await pickTask(api, def, projectId);
    if (!task) {
      log(`[${role}] board is clear - nothing to do.`);
      break;
    }
    log(`[${role}] #${task.number} ${task.title}`);
    await api.setStatus(task.id, 'in_progress').catch(() => {});
    const result = dry
      ? { ok: true, summary: `(dry run) ${def.displayName} picked up #${task.number}; no code executed.` }
      : runClaude(def, task, { apply });
    await api.addComment(task.id, result.summary);
    if (result.ok) {
      await api.requestReview(task.id, reviewerId).catch((e) => log(`  request_review: ${e.message}`));
      log(`  -> review requested`);
    } else {
      log(`  -> left in_progress: ${result.summary.split('\n')[0]}`);
    }
  } while (!once);
}
