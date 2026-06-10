#!/usr/bin/env node
// Poster side of a direct-hire lifecycle run. Funds the worker if its gas is
// low, then posts a v3 direct-hire bounty from the deployer wallet via the
// local SDK build and prints the bountyId.
// Usage: node scripts/dh-post.mjs --worker 1 --issue <url> --repo <url> \
//          [--amount 1] [--stake 0.05] [--type 0] [--days 3] [--fund 0.15]
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { ClaudelanceClient } = require(join(ROOT, 'packages/sdk/dist/index.cjs'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.worker || !args.issue || !args.repo) {
  console.error('required: --worker N --issue <url> --repo <url>');
  process.exit(1);
}

const CELO_TOKEN = '0x471EcE3750Da237f93B8E339c536989b8978a438';
const RPC = 'https://forno.celo.org';
const chain = { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };

const envFile = readFileSync(join(ROOT, 'contracts/.env'), 'utf8');
const deployerKey = envFile.match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();

const wf = readFileSync(join(ROOT, 'claudelance worker', `worker ${args.worker}`, 'wallet.env'), 'utf8');
const workerAddr = wf.match(/^ADDRESS=(.+)$/m)[1].trim();

const pub = createPublicClient({ chain, transport: http(RPC) });
const fundFloor = parseEther(args.fund ?? '0.15');
const workerBal = await pub.getBalance({ address: workerAddr });
if (workerBal < fundFloor) {
  const account = privateKeyToAccount(deployerKey);
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  const gasPrice = ((await pub.getGasPrice()) * 15n) / 10n;
  const topUp = fundFloor - workerBal;
  const hash = await wallet.sendTransaction({ to: workerAddr, value: topUp, gas: 21000n, gasPrice });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`funded w${args.worker} +${formatEther(topUp)} CELO tx=${hash}`);
} else {
  console.log(`w${args.worker} balance ${formatEther(workerBal)} CELO, no top-up`);
}

const cl = ClaudelanceClient.fromPrivateKey({ privateKey: deployerKey, network: 'celo' });
const { hash, bountyId } = await cl.postDirectHireAndGetId({
  token: CELO_TOKEN,
  targetWorker: workerAddr,
  bountyType: Number(args.type ?? 0),
  targetRepoUrl: args.repo,
  instructionUrl: args.issue,
  amount: parseEther(args.amount ?? '1'),
  stake: parseEther(args.stake ?? '0.05'),
  deadlineSeconds: BigInt(Number(args.days ?? 3) * 86400),
});
console.log(`posted bountyId=${bountyId} worker=${workerAddr} tx=${hash}`);
