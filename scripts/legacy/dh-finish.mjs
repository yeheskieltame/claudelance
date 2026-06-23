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

// forno intermittently returns -32011 ("no backend healthy") on the write path;
// fall back across ankr + dRPC so pickWinner/settle/attest ride it out.
const RPC_URLS = (process.env.CELO_RPC_URLS || 'https://forno.celo.org,https://rpc.ankr.com/celo')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
const cl = ClaudelanceClient.fromPrivateKey({ privateKey: deployerKey, network: 'celo', rpcUrls: RPC_URLS });
const bountyId = BigInt(args.bounty);

// agentId is only used for reputation logging + attest tracking; pickWinner
// itself takes the address. The swarm minted identities on 2026-05-15 (outside
// agentIdOf's default window) so it needs a deep getLogs scan - which flakes
// when forno returns -32011 or a backup caps the block range. So accept an
// explicit --agentId override and never let this lookup abort the finish.
let agentId = args.agentId ? BigInt(args.agentId) : null;
if (!agentId) {
  try {
    const latestBlock = await cl.publicClient.getBlockNumber();
    agentId = await cl.agentIdOf(workerAddr, { fromBlock: latestBlock > 4_000_000n ? latestBlock - 4_000_000n : 0n });
  } catch (e) {
    console.log(`agentId lookup failed (${e.shortMessage || e.message}); pass --agentId N to track reputation`);
  }
}
let repBefore = null;
try {
  repBefore = agentId ? await cl.getReputation(agentId) : null;
} catch (e) {
  console.log(`reputation read failed (${e.shortMessage || e.message}); continuing without a before-snapshot`);
}

const t0 = Date.now();
const tx = await cl.pickWinner(bountyId, workerAddr);
await cl.publicClient.waitForTransactionReceipt({ hash: tx });
console.log(`pickWinner tx=${tx} (worker agentId=${agentId ?? 'none'} feedback=${repBefore?.feedbackCount ?? '-'})`);

const deadline = Date.now() + Number(args['watch-min'] ?? 7) * 60_000;
const pollMs = Number(args['poll-sec'] ?? 20) * 1000;
let settled = false, attested = false;
while (Date.now() < deadline && !(settled && attested)) {
  await new Promise((r) => setTimeout(r, pollMs));
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

// Poster-side service receipt: the keeper (agent 9144) closed this bounty's
// tail, so the poster records +1 ERC-8004 feedback for it.
if (settled && args['no-thanks'] === undefined) {
  const KEEPER_AGENT_ID = 9144n;
  try {
    const fbTx = await cl.giveFeedback(KEEPER_AGENT_ID, {
      value: 100n,
      tag1: 'claudelance',
      tag2: 'keeper-service',
      endpoint: `bounty:${args.bounty}`,
    });
    console.log(`poster feedback to keeper agent ${KEEPER_AGENT_ID} tx=${fbTx}`);
  } catch (e) {
    console.log(`poster feedback failed: ${(e.shortMessage ?? e.message).slice(0, 100)}`);
  }
}
