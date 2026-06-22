#!/usr/bin/env node
// Entry point for `claudelance-worker` / `clw`.

import { bootstrap } from './bootstrap.js';
import { kits } from './kits.js';
import { runWorker } from './loop.js';
import { status, orchestrate } from './orchestrate.js';
import { ROSTER } from './roster.js';
import { die } from './util.js';

const HELP = `claudelance-worker (clw) - run the Claudelance team on the Coworking board

  clw bootstrap                 create members + keys + project + backlog (owner key)
  clw kits                      generate each worker's Claude Code agent kit
  clw run <role> [--once] [--apply] [--dry]
                                run a worker headlessly (default: plan-mode, loops)
  clw orchestrate [approve|changes|reject <taskId>]
                                Tech Lead review inbox / verdicts (owner key)
  clw status                    board overview (owner key)

roles: ${ROSTER.map((r) => r.role).join(', ')}

env (or .local/.env.workers, written by bootstrap):
  COWORKING_API_URL, CLW_OWNER_KEY (owner/admin), CLW_KEY_<ROLE> (per worker)`;

const [cmd, ...rest] = process.argv.slice(2);
const flags = (a) => ({ once: a.includes('--once'), apply: a.includes('--apply'), dry: a.includes('--dry') });
const role = rest.find((x) => !x.startsWith('-'));

try {
  switch (cmd) {
    case 'bootstrap':
      await bootstrap();
      break;
    case 'kits':
      await kits();
      break;
    case 'run':
      if (!role) die('usage: clw run <role> [--once] [--apply] [--dry]');
      await runWorker(role, flags(rest));
      break;
    case 'orchestrate':
      await orchestrate(rest);
      break;
    case 'status':
      await status();
      break;
    default:
      console.log(HELP);
  }
} catch (e) {
  die(e);
}
