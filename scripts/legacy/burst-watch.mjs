#!/usr/bin/env node
// Watch the Railway keeper digest a burst: poll stakeSettled and ERC-8004
// feedback for a set of just-resolved bounties and print when each closes.
// Usage: node scripts/burst-watch.mjs --start 11 --end 20 [--watch-min 12]
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

const wave = JSON.parse(readFileSync(join(ROOT, `scripts/.burst-wave-${args.start}-${args.end}.json`), 'utf8'));
const cl = ClaudelanceClient.fromRpcUrl({ network: 'celo' });

const items = [];
for (const b of wave.bounties.filter((x) => x.status === 'success')) {
  const f = readFileSync(join(ROOT, 'claudelance worker', `worker ${b.n}`, 'wallet.env'), 'utf8');
  items.push({ n: b.n, bountyId: BigInt(b.bountyId), addr: f.match(/^ADDRESS=(.+)$/m)[1].trim(), settled: null, attested: null, feedback0: null, agentId: null });
}

const latest = await cl.publicClient.getBlockNumber();
for (const it of items) {
  it.agentId = await cl.agentIdOf(it.addr, { fromBlock: latest > 4_000_000n ? latest - 4_000_000n : 0n });
  if (it.agentId) it.feedback0 = (await cl.getReputation(it.agentId)).feedbackCount;
}

const t0 = Date.now();
const deadline = t0 + Number(args['watch-min'] ?? 12) * 60_000;
while (Date.now() < deadline && items.some((i) => i.settled === null || (i.agentId && i.attested === null))) {
  await new Promise((r) => setTimeout(r, 20_000));
  for (const it of items) {
    if (it.settled === null) {
      const sub = await cl.getSubmission(it.bountyId, it.addr);
      if (sub.stakeSettled) {
        it.settled = (Date.now() - t0) / 1000;
        console.log(`[keeper] settle  w${it.n} bounty=${it.bountyId} +${it.settled.toFixed(0)}s`);
      }
    }
    if (it.agentId && it.attested === null) {
      const rep = await cl.getReputation(it.agentId);
      if (rep.feedbackCount > it.feedback0) {
        it.attested = (Date.now() - t0) / 1000;
        console.log(`[keeper] attest  w${it.n} agent=${it.agentId} +${it.attested.toFixed(0)}s (${it.feedback0} -> ${rep.feedbackCount})`);
      }
    }
  }
}
const settled = items.filter((i) => i.settled !== null);
const attested = items.filter((i) => i.attested !== null);
console.log(`[summary] settled ${settled.length}/${items.length}, attested ${attested.length}/${items.filter((i) => i.agentId).length}`);
if (settled.length) console.log(`[summary] settle window: ${Math.min(...settled.map((i) => i.settled)).toFixed(0)}s to ${Math.max(...settled.map((i) => i.settled)).toFixed(0)}s`);
for (const it of items.filter((i) => i.settled === null)) console.log(`[summary] NOT settled: w${it.n} bounty=${it.bountyId}`);
