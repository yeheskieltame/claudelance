#!/usr/bin/env node
// Top up one or more swarm workers to a TARGET native CELO balance from the
// deployer wallet, sized for the current (elevated) Celo gas so a worker can
// afford claimSlot (stake + gas) + submitDeliverable in one lifecycle.
// Usage: node scripts/topup-worker.mjs --workers 1,2,3 --target 0.3
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const workers = (args.workers ?? '1').split(',').map((s) => s.trim()).filter(Boolean);
const target = parseEther(args.target ?? '0.3');

const RPC = 'https://forno.celo.org';
const chain = { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };

const envFile = readFileSync(join(ROOT, 'contracts/.env'), 'utf8');
const deployerKey = envFile.match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const account = privateKeyToAccount(deployerKey);

const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

let nonce = await pub.getTransactionCount({ address: account.address });
const gasPrice = ((await pub.getGasPrice()) * 15n) / 10n;

for (const w of workers) {
  const wf = readFileSync(join(ROOT, 'claudelance worker', `worker ${w}`, 'wallet.env'), 'utf8');
  const addr = wf.match(/^ADDRESS=(.+)$/m)[1].trim();
  const bal = await pub.getBalance({ address: addr });
  if (bal >= target) {
    console.log(`w${w} ${formatEther(bal)} CELO >= target, skip`);
    continue;
  }
  const topUp = target - bal;
  const hash = await wallet.sendTransaction({ to: addr, value: topUp, gas: 21000n, gasPrice, nonce: nonce++ });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`w${w} +${formatEther(topUp)} -> ${formatEther(target)} CELO tx=${hash}`);
}
