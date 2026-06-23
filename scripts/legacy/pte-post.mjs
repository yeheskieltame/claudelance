#!/usr/bin/env node
// Play-to-earn bounty poster: posts a Claudelance direct-hire bounty that pays
// the reward in $LANCE for playing BingoChain. Funds the worker's gas (CELO) AND
// its $LANCE stake, then posts the bounty (token = $LANCE) and prints bountyId.
// See docs/play-to-earn-bounty.md.
//
// Usage: node scripts/pte-post.mjs --worker N --reward 100 --stake 5 \
//          [--games 2] [--proof <specUrl>] [--days 3] [--fund 0.3]
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { createPublicClient, createWalletClient, http, parseEther, formatEther, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { ClaudelanceClient } = require(join(ROOT, 'packages/sdk/dist/index.cjs'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.worker) { console.error('required: --worker N'); process.exit(1); }

const LANCE = '0xb70c9Cd73428Afe51eEEA832C49E8840D3f85cA2';
const BINGO_REPO = 'https://github.com/yeheskieltame/BINGOChain';
const RPC = 'https://forno.celo.org';
const chain = { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const FEE = { maxFeePerGas: parseGwei('260'), maxPriorityFeePerGas: parseGwei('2') };
const erc20 = [
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 't', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const reward = parseEther(args.reward ?? '100');
const stake = parseEther(args.stake ?? '5');
const games = Number(args.games ?? 2);
const proof = args.proof ?? `Play ${games} BingoChain arenas staking $LANCE, then submit the ${games} ArenaSettled tx hashes. Spec: docs/play-to-earn-bounty.md`;

const envFile = readFileSync(join(ROOT, 'contracts/.env'), 'utf8');
const deployerKey = envFile.match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const wf = readFileSync(join(ROOT, 'claudelance worker', `worker ${args.worker}`, 'wallet.env'), 'utf8');
const workerAddr = wf.match(/^ADDRESS=(.+)$/m)[1].trim();

const account = privateKeyToAccount(deployerKey.startsWith('0x') ? deployerKey : `0x${deployerKey}`);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

// 1. fund worker gas (CELO)
const gasFloor = parseEther(args.fund ?? '0.3');
const gasBal = await pub.getBalance({ address: workerAddr });
if (gasBal < gasFloor) {
  const h = await wallet.sendTransaction({ to: workerAddr, value: gasFloor - gasBal, gas: 30000n, ...FEE });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`funded w${args.worker} gas +${formatEther(gasFloor - gasBal)} CELO`);
}

// 2. fund worker $LANCE stake (stake + buffer so claimSlot can stake)
const lanceFloor = stake + stake; // 2x stake buffer
const lanceBal = await pub.readContract({ address: LANCE, abi: erc20, functionName: 'balanceOf', args: [workerAddr] });
if (lanceBal < lanceFloor) {
  const h = await wallet.writeContract({ address: LANCE, abi: erc20, functionName: 'transfer', args: [workerAddr, lanceFloor - lanceBal], gas: 80000n, ...FEE });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`funded w${args.worker} +${formatEther(lanceFloor - lanceBal)} $LANCE (stake)`);
}

// 3. post the $LANCE play-to-earn bounty (SDK auto-approves $LANCE for the escrow)
const cl = ClaudelanceClient.fromPrivateKey({ privateKey: deployerKey, network: 'celo' });
const { hash, bountyId } = await cl.postDirectHireAndGetId({
  token: LANCE,
  targetWorker: workerAddr,
  bountyType: 10, // Custom
  targetRepoUrl: BINGO_REPO,
  instructionUrl: proof,
  amount: reward,
  stake,
  deadlineSeconds: BigInt(Number(args.days ?? 3) * 86400),
});
console.log(`posted play-to-earn bountyId=${bountyId} worker=${workerAddr} reward=${formatEther(reward)} $LANCE stake=${formatEther(stake)} tx=${hash}`);
