#!/usr/bin/env node
// Sweep a worker's CELO back to the deployer/poster wallet so the same CELO can
// be reused for the next dogfood bounty. Keeps a small dust reserve for gas.
// Usage: node scripts/sweep-to-poster.mjs --worker N [--keep 0.02]
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
if (!args.worker) {
  console.error('required: --worker N');
  process.exit(1);
}

const deployerKey = readFileSync(join(ROOT, 'contracts/.env'), 'utf8')
  .match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const POSTER = privateKeyToAccount(deployerKey.startsWith('0x') ? deployerKey : `0x${deployerKey}`).address;

const wf = readFileSync(join(ROOT, 'claudelance worker', `worker ${args.worker}`, 'wallet.env'), 'utf8');
const pk = wf.match(/^PRIVATE_KEY=(.+)$/m)[1].trim();
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);

const RPC = 'https://forno.celo.org';
const chain = { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const keep = parseEther(args.keep ?? '0.02');
const bal = await pub.getBalance({ address: account.address });
const gasPrice = ((await pub.getGasPrice()) * 15n) / 10n;
const gasCost = 21000n * gasPrice;
const send = bal - keep - gasCost;
if (send <= 0n) {
  console.log(`w${args.worker} balance ${formatEther(bal)} CELO, nothing to sweep`);
  process.exit(0);
}
const nonce = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' });
const hash = await wallet.sendTransaction({ to: POSTER, value: send, gas: 21000n, gasPrice, nonce });
await pub.waitForTransactionReceipt({ hash });
console.log(`swept ${formatEther(send)} CELO w${args.worker} -> poster tx=${hash}`);
