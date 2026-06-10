#!/usr/bin/env node
// Sweep native CELO from all 30 local workers to the deployer wallet.
// Legacy txs with fixed gasPrice so the sweep amount is exact (no dust).
// All 30 sends fire in parallel; each worker has its own nonce lane.
// Run from repo root: node scripts/consolidate-workers.mjs
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { createPublicClient, createWalletClient, http, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const RPC = 'https://forno.celo.org';
const DEPLOYER = '0x77c4a1cD22005b67Eb9CcEaE7E9577188d7Bca82';
const chain = { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };

const pub = createPublicClient({ chain, transport: http(RPC) });

function loadWorker(n) {
  const f = readFileSync(join(ROOT, 'claudelance worker', `worker ${n}`, 'wallet.env'), 'utf8');
  return {
    n,
    addr: f.match(/^ADDRESS=(.+)$/m)[1].trim(),
    key: f.match(/^PRIVATE_KEY=(.+)$/m)[1].trim(),
  };
}

const gasPriceLive = await pub.getGasPrice();
const gasPrice = (gasPriceLive * 15n) / 10n;
const fee = 21000n * gasPrice;
console.log(`gasPrice live=${gasPriceLive} using=${gasPrice} sweepFee=${formatEther(fee)} CELO`);

const workers = Array.from({ length: 30 }, (_, i) => loadWorker(i + 1));

const results = await Promise.all(workers.map(async (w) => {
  try {
    const bal = await pub.getBalance({ address: w.addr });
    if (bal <= fee) return { n: w.n, status: 'skip', detail: `balance ${formatEther(bal)} <= fee` };
    const account = privateKeyToAccount(w.key);
    const wallet = createWalletClient({ account, chain, transport: http(RPC) });
    const value = bal - fee;
    const hash = await wallet.sendTransaction({ to: DEPLOYER, value, gas: 21000n, gasPrice });
    const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
    return { n: w.n, status: rcpt.status, detail: `swept ${formatEther(value)} CELO tx=${hash}` };
  } catch (e) {
    return { n: w.n, status: 'error', detail: e.shortMessage ?? e.message };
  }
}));

for (const r of results.sort((a, b) => a.n - b.n)) console.log(`w${r.n}: ${r.status} ${r.detail}`);
const after = await pub.getBalance({ address: DEPLOYER });
console.log(`deployer after: ${formatEther(after)} CELO`);
