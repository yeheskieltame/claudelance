#!/usr/bin/env node
// Poster side, tail of a lifecycle run: pick the winner, then watch the
// Railway keeper close the bounty (settleStake + attestReputation) without
// local intervention. Reports timings so keeper behaviour under load is
// visible.
// Usage: node scripts/dh-finish.mjs --bounty <id> --worker <n> [--watch-min 7]
import { readFileSync } from 'fs';
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
  console.error('required: --bounty <id> --worker <n>');
  process.exit(1);
}

const envFile = readFileSync(join(ROOT, 'contracts/.env'), 'utf8');
const deployerKey = envFile.match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const wf = readFileSync(join(ROOT, 'claudelance worker', `worker ${args.worker}`, 'wallet.env'), 'utf8');
const workerAddr = wf.match(/^ADDRESS=(.+)$/m)[1].trim();

const cl = ClaudelanceClient.fromPrivateKey({ privateKey: deployerKey, network: 'celo' });
const bountyId = BigInt(args.bounty);

const agentId = await cl.agentIdOf(workerAddr);
const repBefore = agentId ? await cl.getReputation(agentId) : null;

const t0 = Date.now();
const tx = await cl.pickWinner(bountyId, workerAddr);
await cl.publicClient.waitForTransactionReceipt({ hash: tx });
console.log(`pickWinner tx=${tx} (worker agentId=${agentId ?? 'none'} feedback=${repBefore?.feedbackCount ?? '-'})`);

const deadline = Date.now() + Number(args['watch-min'] ?? 7) * 60_000;
let settled = false, attested = false;
while (Date.now() < deadline && !(settled && attested)) {
  await new Promise((r) => setTimeout(r, 20_000));
  if (!settled) {
    const sub = await cl.getSubmission(bountyId, workerAddr);
    if (sub.stakeSettled) {
      settled = true;
      console.log(`keeper settleStake confirmed +${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  if (!attested && agentId) {
    const rep = await cl.getReputation(agentId);
    if (repBefore && rep.feedbackCount > repBefore.feedbackCount) {
      attested = true;
      console.log(`keeper attestReputation confirmed +${((Date.now() - t0) / 1000).toFixed(0)}s (feedback ${repBefore.feedbackCount} -> ${rep.feedbackCount})`);
    }
  }
}
if (!settled) console.log('keeper did NOT settle stake within the watch window');
if (!attested) console.log('keeper did NOT attest reputation within the watch window');
