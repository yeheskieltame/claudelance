#!/usr/bin/env node
// Top up the Railway keeper (ERC-8004 agent 9144) with native CELO from the
// deployer. The keeper's settleStake/attestReputation/cancelExpired sends fail
// silently once its balance drops under ~0.3 CELO, so a burst of bounties can
// strand the tail. Run after a heavy batch.
// Usage: node scripts/refill-keeper.mjs [--amount 1.5]
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
const amount = parseEther(args.amount ?? '1.5');

const KEEPER = '0x1fEDda23c2945D59f3929e6C463cF685aC077ad5';
const RPC = 'https://forno.celo.org';
const chain = { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };

const deployerKey = readFileSync(join(ROOT, 'contracts/.env'), 'utf8').match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const account = privateKeyToAccount(deployerKey);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const before = await pub.getBalance({ address: KEEPER });
const gasPrice = ((await pub.getGasPrice()) * 15n) / 10n;
const nonce = await pub.getTransactionCount({ address: account.address });
const hash = await wallet.sendTransaction({ to: KEEPER, value: amount, gas: 21000n, gasPrice, nonce });
await pub.waitForTransactionReceipt({ hash });
const after = await pub.getBalance({ address: KEEPER });
console.log(`keeper ${formatEther(before)} -> ${formatEther(after)} CELO (+${formatEther(amount)}) tx=${hash}`);
