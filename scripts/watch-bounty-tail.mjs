#!/usr/bin/env node
// Watches a bounty through its post-submission tail: pickWinner (from any
// wallet, e.g. MiniPay), then the keeper's settleStake and attestReputation.
// Read-only; exits 0 once the tail is fully closed.
// Usage: node scripts/watch-bounty-tail.mjs --bounty <id> --worker <addr> [--timeout-min 40]
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { ClaudelanceClient } = require(join(ROOT, 'packages/sdk/dist/index.cjs'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.bounty || !args.worker) {
  console.error('required: --bounty <id> --worker <addr>');
  process.exit(1);
}

const cl = ClaudelanceClient.fromRpcUrl({ network: 'celo' });
const bountyId = BigInt(args.bounty);
const worker = args.worker;
const deadline = Date.now() + Number(args['timeout-min'] ?? 40) * 60_000;

let resolved = false;
let settled = false;
const t0 = Date.now();
const elapsed = () => `+${((Date.now() - t0) / 1000).toFixed(0)}s`;

while (Date.now() < deadline && !(resolved && settled)) {
  try {
    if (!resolved) {
      const b = await cl.getBounty(bountyId);
      if (b.status === 1) {
        resolved = true;
        console.log(`pickWinner landed ${elapsed()} (winner=${b.winner})`);
      }
    }
    if (resolved && !settled) {
      const sub = await cl.getSubmission(bountyId, worker);
      if (sub.stakeSettled) {
        settled = true;
        console.log(`keeper settleStake confirmed ${elapsed()}`);
      }
    }
  } catch {
    // forno replica lag: tolerate transient read failures and keep polling
  }
  if (!(resolved && settled)) await new Promise((r) => setTimeout(r, 20_000));
}

if (!resolved) {
  console.error('timeout: bounty never resolved');
  process.exit(1);
}
if (!settled) {
  console.error('resolved, but keeper settleStake not seen before timeout');
  process.exit(2);
}
console.log('tail closed');
