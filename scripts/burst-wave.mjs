#!/usr/bin/env node
// One wave of the swarm stress test: fund N workers, post N direct hires,
// then fire every worker's claim+submit at the same moment and every
// pickWinner in parallel with explicit nonces. Prints per-step timings so
// chain and keeper behaviour under burst load is measurable.
// Usage: node scripts/burst-wave.mjs --start 11 --end 20 --issue <url> [--amount 1] [--stake 0.05]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { ClaudelanceClient } = require(join(ROOT, 'packages/sdk/dist/index.cjs'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const START = Number(args.start), END = Number(args.end);
if (!START || !END || !args.issue) {
  console.error('required: --start N --end N --issue <url>');
  process.exit(1);
}

const RPC = 'https://forno.celo.org';
const CELO_TOKEN = '0x471EcE3750Da237f93B8E339c536989b8978a438';
const chain = { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });

const envFile = readFileSync(join(ROOT, 'contracts/.env'), 'utf8');
const deployerKey = envFile.match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const deployer = privateKeyToAccount(deployerKey);
const deployerWallet = createWalletClient({ account: deployer, chain, transport: http(RPC) });

const workers = [];
for (let n = START; n <= END; n++) {
  const dir = join(ROOT, 'claudelance worker', `worker ${n}`);
  const f = readFileSync(join(dir, 'wallet.env'), 'utf8');
  workers.push({ n, dir, addr: f.match(/^ADDRESS=(.+)$/m)[1].trim() });
}

const FUND = parseEther('0.35');
const AMOUNT = parseEther(args.amount ?? '1');
const STAKE = parseEther(args.stake ?? '0.05');

// 1. Fund all wave workers in parallel with explicit nonces.
console.log(`[fund] topping up ${workers.length} workers`);
const gasPrice = ((await pub.getGasPrice()) * 15n) / 10n;
let nonce = await pub.getTransactionCount({ address: deployer.address });
const fundHashes = await Promise.all(workers.map(async (w, i) => {
  const bal = await pub.getBalance({ address: w.addr });
  if (bal >= FUND) return null;
  return deployerWallet.sendTransaction({ to: w.addr, value: FUND - bal, gas: 21000n, gasPrice, nonce: nonce + i });
}));
await Promise.all(fundHashes.filter(Boolean).map((h) => pub.waitForTransactionReceipt({ hash: h, timeout: 180_000 })));
console.log(`[fund] done (${fundHashes.filter(Boolean).length} sends)`);

// 2. Post N direct hires sequentially (bountyId mapping must stay unambiguous).
const cl = ClaudelanceClient.fromPrivateKey({ privateKey: deployerKey, network: 'celo' });
const posts = [];
for (const w of workers) {
  const { bountyId, hash } = await cl.postDirectHireAndGetId({
    token: CELO_TOKEN,
    targetWorker: w.addr,
    bountyType: 10,
    targetRepoUrl: 'https://github.com/yeheskieltame/claudelance',
    instructionUrl: args.issue,
    amount: AMOUNT,
    stake: STAKE,
    deadlineSeconds: BigInt(2 * 86400),
  });
  posts.push({ ...w, bountyId });
  console.log(`[post] w${w.n} bounty=${bountyId} tx=${hash}`);
}

// 3. Simultaneous claim+submit across the whole wave (the burst moment).
//    Each worker runs in its own process against its own fresh-installed SDK.
console.log(`[burst] firing ${posts.length} claim+submit pipelines at once`);
const t0 = Date.now();
const results = await Promise.all(posts.map(async (p) => {
  try {
    const { stdout } = await run('node', [
      'run.mjs', 'work', p.bountyId.toString(), args.issue,
      `0x${'0'.repeat(24)}${'ab'.repeat(20)}`,
    ], { cwd: p.dir, timeout: 600_000, env: { ...process.env, NODE_OPTIONS: '' } });
    const line = stdout.trim().split('\n').pop();
    return { ...p, ok: true, secs: (Date.now() - t0) / 1000, out: line };
  } catch (e) {
    return { ...p, ok: false, secs: (Date.now() - t0) / 1000, out: (e.stderr || e.message || '').split('\n').slice(-8).join(' | ') };
  }
}));
for (const r of results) console.log(`[burst] w${r.n} bounty=${r.bountyId} ${r.ok ? 'OK' : 'FAIL'} +${r.secs.toFixed(0)}s ${r.ok ? '' : r.out}`);

// 4. Parallel pickWinner with explicit nonces for every successful submit.
const winners = results.filter((r) => r.ok);
console.log(`[pick] resolving ${winners.length} bounties in parallel`);
nonce = await pub.getTransactionCount({ address: deployer.address });
const gasPrice2 = ((await pub.getGasPrice()) * 2n);
const CORE_ABI = [{ name: 'pickWinner', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'bountyId', type: 'uint256' }, { name: 'worker', type: 'address' }], outputs: [] }];
const pickResults = await Promise.all(winners.map(async (w, i) => {
  try {
    const hash = await deployerWallet.writeContract({
      address: '0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8',
      abi: CORE_ABI,
      functionName: 'pickWinner',
      args: [w.bountyId, w.addr],
      gas: 500_000n,
      gasPrice: gasPrice2,
      nonce: nonce + i,
    });
    const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
    return { n: w.n, bountyId: w.bountyId, status: rcpt.status, hash };
  } catch (e) {
    return { n: w.n, bountyId: w.bountyId, status: 'error', hash: e.shortMessage ?? e.message };
  }
}));
for (const p of pickResults) console.log(`[pick] w${p.n} bounty=${p.bountyId} ${p.status} ${p.hash}`);

const summary = { wave: `${START}-${END}`, resolvedAt: null, bounties: pickResults.map((p) => ({ n: p.n, bountyId: p.bountyId.toString(), status: p.status })) };
const outPath = join(ROOT, `scripts/.burst-wave-${START}-${END}.json`);
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`[done] wave summary written to ${outPath}`);
