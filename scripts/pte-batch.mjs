#!/usr/bin/env node
// Batch play-to-earn: runs the full loop for several workers, sequentially, by
// orchestrating the proven single-step scripts. Each worker:
//   post $LANCE bounty (pte-post) → submit BingoChain $LANCE play proof (run.mjs
//   work) → resolve (dh-finish) → withdraw $LANCE (run.mjs withdraw).
// Proofs are real BingoChain $LANCE ArenaSettled tx hashes (operator dogfood).
// See docs/play-to-earn-bounty.md.
//
// Usage: node scripts/pte-batch.mjs --workers 5,6,7 [--reward 30] [--stake 5] [--games 1]
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { keccak256, toHex } = require('viem');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.workers) { console.error('required: --workers 5,6,7'); process.exit(1); }
const workers = args.workers.split(',').map((s) => s.trim()).filter(Boolean);
const reward = args.reward ?? '30';
const stake = args.stake ?? '5';
const games = args.games ?? '1';

// real $LANCE settle-tx proofs from the latest BingoChain wave
const RESULTS = join(ROOT, '..', 'Bingo-chain', 'scripts', 'out', 'results-lance90.json');
const proofs = JSON.parse(readFileSync(RESULTS, 'utf8')).games
  .map((g) => (g.timeline.find((e) => e.type === 'ArenaSettled') || {}).tx)
  .filter(Boolean);

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const results = [];
for (let i = 0; i < workers.length; i++) {
  const w = workers[i];
  const proofTx = proofs[i % proofs.length];
  const proofUrl = `https://celoscan.io/tx/${proofTx}`;
  const proofHash = keccak256(toHex(proofUrl));
  try {
    log(`worker ${w}: posting $LANCE bounty (reward ${reward}, proof game ${i + 1})…`);
    const postOut = sh(`node scripts/pte-post.mjs --worker ${w} --reward ${reward} --stake ${stake} --games ${games} --proof "${proofUrl}"`, { cwd: ROOT });
    const bountyId = postOut.match(/bountyId=(\d+)/)?.[1];
    if (!bountyId) throw new Error(`no bountyId in: ${postOut.slice(-120)}`);

    log(`worker ${w}: submitting proof to bounty #${bountyId}…`);
    sh(`node run.mjs work ${bountyId} "${proofUrl}" ${proofHash}`, { cwd: join(ROOT, 'claudelance worker', `worker ${w}`) });

    log(`worker ${w}: finishing bounty #${bountyId}…`);
    sh(`node scripts/dh-finish.mjs --bounty ${bountyId} --worker ${w} --watch-min 6`, { cwd: ROOT });

    log(`worker ${w}: withdrawing $LANCE…`);
    const wd = sh(`node run.mjs withdraw`, { cwd: join(ROOT, 'claudelance worker', `worker ${w}`) }).trim();

    results.push({ worker: w, bountyId, proofTx, withdraw: wd.split('\n').pop() });
    log(`worker ${w}: DONE (bounty #${bountyId})`);
  } catch (e) {
    const msg = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    results.push({ worker: w, error: msg.slice(-200) });
    log(`worker ${w}: FAILED - ${msg.slice(-160)}`);
  }
}

console.log('\n══════════ BATCH PLAY-TO-EARN SUMMARY ══════════');
for (const r of results) {
  if (r.error) console.log(`worker ${r.worker}: ❌ ${r.error}`);
  else console.log(`worker ${r.worker}: ✅ bounty #${r.bountyId} · reward ${reward} $LANCE · proof ${r.proofTx.slice(0, 12)}…`);
}
const ok = results.filter((r) => !r.error).length;
console.log(`\n${ok}/${workers.length} workers earned $LANCE · ${Number(reward) * ok} $LANCE distributed`);
