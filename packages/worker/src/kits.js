// Generate a self-contained agent kit per worker under workers/<role>/. Each kit
// makes that worker an INDEPENDENT Claude Code agent whose only coordination
// channel is the Claudelance Coworking MCP:
//   - .mcp.json   : HTTP MCP server -> <api>/mcp, authed with the worker's key
//   - brief.md    : appended to the system prompt (identity, expertise, the loop)
//   - run.sh      : launches `claude` from the repo root with that config + brief
// Run after bootstrap (which mints the keys). The workers/ dir is gitignored.

import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

import { ROSTER, PROJECT } from './roster.js';
import { loadEnv, baseUrl, keyVar, WORKERS_DIR, log } from './util.js';

function brief(r) {
  return `You are the **${r.displayName}** on the Claudelance team. Your turf: ${r.focus}.

You coordinate ONLY through the \`claudelance\` MCP server (the Coworking board). Never
wait for a human to hand you work - pull it from the board yourself.

Your loop each session:
1. Find the "Daily standup" task (\`list_tasks\` on project ${PROJECT.key}) and post a standup
   comment: yesterday / today / blockers.
2. \`my_open_tasks\` - if you already own an unfinished task, continue it.
3. Otherwise \`whats_next\` on ${PROJECT.key} and \`claim_task\` the highest-priority task that
   fits your expertise (${r.taskTypes.join(', ')}).
4. \`update_task_status\` -> in_progress.
5. Do the work in this repo on a branch named \`worker/${r.role}\`. Per-file commits, English
   only. Run /security-review before any contract change.
6. \`add_comment\` with a summary + branch/PR link, then \`request_review\` (reviewer = the Tech Lead).
7. Take the next task. Stop when \`whats_next\` is empty.

Stay in your lane (${r.focus}) unless a task explicitly sends you elsewhere. Never merge your
own work - the review loop gates it.`;
}

function mcpConfig(url, key) {
  return {
    mcpServers: {
      claudelance: {
        type: 'http',
        url: `${url}/mcp`,
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  };
}

// REPO_ROOT relative to workers/<role>/: <role> -> workers -> worker -> packages -> repo.
const RUN_SH = (role) => `#!/usr/bin/env bash
# Launch the ${role} worker: an independent Claude Code agent that coordinates
# only through the Claudelance Coworking MCP. Run it from anywhere.
set -euo pipefail
DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/../../../.."   # repo root - the worker edits the real codebase
exec claude --mcp-config "$DIR/.mcp.json" --append-system-prompt "$(cat "$DIR/brief.md")" "$@"
`;

export async function kits() {
  const env = loadEnv();
  const url = baseUrl(env);
  let made = 0;
  for (const r of ROSTER) {
    const key = env[keyVar(r.role)];
    if (!key) {
      log(`! no key for ${r.role} - run \`clw bootstrap\` first; skipping`);
      continue;
    }
    const dir = join(WORKERS_DIR, r.role);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify(mcpConfig(url, key), null, 2) + '\n');
    writeFileSync(join(dir, 'brief.md'), brief(r) + '\n');
    const runPath = join(dir, 'run.sh');
    writeFileSync(runPath, RUN_SH(r.role));
    chmodSync(runPath, 0o755);
    log(`kit -> ${dir}`);
    made++;
  }
  log(`\n${made} kit(s) ready. Launch one: \`bash packages/worker/workers/<role>/run.sh\``);
}
