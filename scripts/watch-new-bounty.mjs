#!/usr/bin/env node
// Watches mainnet v3 for the next bounty to appear, optionally filtered by
// targetWorker. Used in interactive poster sessions where the post tx comes
// from a wallet outside this repo (e.g. MiniPay), so there is no local tx
// hash to await. Prints the new bounty as JSON and exits.
// Usage: node scripts/watch-new-bounty.mjs --target <workerAddr> [--timeout-min 30]
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { ClaudelanceClient } = require(join(ROOT, 'packages/sdk/dist/index.cjs'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];

const cl = ClaudelanceClient.fromRpcUrl({ network: 'celo' });
const target = args.target?.toLowerCase();
const deadline = Date.now() + Number(args['timeout-min'] ?? 30) * 60_000;

const baseCount = await cl.getBountyCountV3();
console.log(`baseline bountyCount=${baseCount}, watching for #${baseCount + 1n}...`);

let next = baseCount + 1n;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15_000));
  try {
    const b = await cl.getBounty(next);
    if (b.poster && b.poster !== '0x0000000000000000000000000000000000000000') {
      if (target && b.targetWorker?.toLowerCase() !== target) {
        console.log(`bounty #${next} appeared but targets ${b.targetWorker}, skipping`);
        next += 1n;
        continue;
      }
      console.log(JSON.stringify(
        { id: next.toString(), poster: b.poster, targetWorker: b.targetWorker, token: b.token,
          amount: b.amount.toString(), stake: b.stakeRequired.toString(), bountyType: b.bountyType,
          deadline: b.deadline.toString() },
        null, 2,
      ));
      process.exit(0);
    }
  } catch {
    // forno replica lag: a fresh id can 404 on one replica and exist on the
    // next read, so just keep polling.
  }
}
console.error('timeout: no matching bounty appeared');
process.exit(1);
