#!/usr/bin/env node
// Worker side of a lifecycle run. This file is copied into a worker dir and
// executed there against a FRESH npm install of @yeheskieltame/claudelance-sdk,
// so every run exercises the exact install-to-earn path a new user takes.
// Usage (cwd = worker dir):
//   node run.mjs work <bountyId> <deliverableUrl> <deliverableHash>
//   node run.mjs withdraw
//   node run.mjs status <bountyId>
//   node run.mjs thank-keeper <bountyId>   (+1 ERC-8004 feedback to the keeper agent)
import { readFileSync } from 'fs';
import { ClaudelanceClient } from '@yeheskieltame/claudelance-sdk';

const wf = readFileSync('./wallet.env', 'utf8');
const privateKey = wf.match(/^PRIVATE_KEY=(.+)$/m)[1].trim();
const address = wf.match(/^ADDRESS=(.+)$/m)[1].trim();

const cl = ClaudelanceClient.fromPrivateKey({ privateKey, network: 'celo' });
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'work') {
  const [bountyId, deliverableUrl, deliverableHash] = rest;
  const res = await cl.runWorkerLoop({
    bountyId: BigInt(bountyId),
    deliverableUrl,
    deliverableHash,
    metadata: JSON.stringify({ agent: 'claude-code', model: 'claude-fable-5' }),
    onProgress: (p) => console.log(`[${address.slice(0, 8)}] ${p.stage} ${p.tx ?? ''} ${p.detail ?? ''}`),
  });
  console.log(JSON.stringify({ identityTx: res.identityTx, claimTx: res.claimTx, submitTx: res.submitTx }));
} else if (cmd === 'withdraw') {
  const out = await cl.withdrawAllEarnings();
  console.log(out.length ? out.map((o) => `${o.token} ${o.hash}`).join('\n') : 'nothing to withdraw');
} else if (cmd === 'status') {
  const sub = await cl.getSubmission(BigInt(rest[0]), address);
  console.log(JSON.stringify(sub, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
} else if (cmd === 'thank-keeper') {
  // The keeper (agent 9144) refunded this worker's stake and wrote its
  // reputation; the worker records the service rendered on the registry.
  const KEEPER_AGENT_ID = 9144n;
  const tx = await cl.giveFeedback(KEEPER_AGENT_ID, {
    tag1: 'claudelance',
    tag2: 'keeper-service',
    endpoint: `bounty:${rest[0] ?? ''}`,
  });
  console.log(`feedback to keeper agent ${KEEPER_AGENT_ID} tx=${tx}`);
} else {
  console.error('usage: run.mjs work <id> <url> <hash> | withdraw | status <id> | thank-keeper <id>');
  process.exit(1);
}
