#!/usr/bin/env node
// Run from repo root: node --experimental-vm-modules scripts/post-sdk-dev-bounties-v3.mjs
// Or: cd packages/sdk && node ../../scripts/post-sdk-dev-bounties-v3.mjs
/**
 * Post 3 direct-hire SDK dev bounties on v3 mainnet.
 * Cross-funding: each worker is poster of one bounty and target of another.
 *
 * B1: w1 posts → w2  (Issue #386 - SDK Error Classes)
 * B2: w2 posts → w3  (Issue #387 - Event Watchers)
 * B3: w3 posts → w1  (Issue #388 - List Filters)
 *
 * Token: CELO ERC20, amount=1 CELO, stake=0.05 CELO, deadline=3 days
 */
import { createPublicClient, createWalletClient, http, parseUnits, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// ── Config ────────────────────────────────────────────────────────────────────
const RPC = 'https://forno.celo.org';
const V3_CORE = '0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8';
const CELO_TOKEN = '0x471EcE3750Da237f93B8E339c536989b8978a438';
const ID8004 = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const CHAIN_ID = 42220;

const celoMainnet = {
  id: CHAIN_ID,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

// ── Load worker keys ──────────────────────────────────────────────────────────
function loadWorker(n) {
  const f = readFileSync(join(ROOT, 'claudelance worker', `worker ${n}`, 'wallet.env'), 'utf8');
  const addr = f.match(/^ADDRESS=(.+)$/m)?.[1]?.trim();
  const key  = f.match(/^PRIVATE_KEY=(.+)$/m)?.[1]?.trim();
  if (!addr || !key) throw new Error(`worker ${n}: missing ADDRESS or PRIVATE_KEY`);
  return { addr, key };
}

const w1 = loadWorker(1);
const w2 = loadWorker(2);
const w3 = loadWorker(3);

// ── ABIs (minimal) ────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
];

const CORE_ABI = [
  { name: 'postDirectHire', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'targetWorker', type: 'address' },
      { name: 'bountyType', type: 'uint8' },
      { name: 'targetRepoUrl', type: 'string' },
      { name: 'instructionUrl', type: 'string' },
      { name: 'requirementsHash', type: 'bytes32' },
      { name: 'amount', type: 'uint96' },
      { name: 'stake', type: 'uint96' },
      { name: 'deadlineSeconds', type: 'uint64' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  { name: 'BountyPosted', type: 'event',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'poster', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'bountyType', type: 'uint8', indexed: false },
      { name: 'amount', type: 'uint96', indexed: false },
      { name: 'maxSlots', type: 'uint8', indexed: false },
      { name: 'targetRepoUrl', type: 'string', indexed: false },
      { name: 'requirementsHash', type: 'bytes32', indexed: false },
    ],
  },
];

const AMOUNT = parseUnits('1', 18);   // 1 CELO
const STAKE  = parseUnits('0.05', 18); // 0.05 CELO
const DEADLINE = BigInt(3 * 24 * 3600); // 3 days
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const REPO_URL = 'https://github.com/yeheskieltame/claudelance';

const publicClient = createPublicClient({ chain: celoMainnet, transport: http(RPC) });

async function ensureAllowance(walletClient, posterAddr) {
  const allowance = await publicClient.readContract({
    address: CELO_TOKEN, abi: ERC20_ABI, functionName: 'allowance',
    args: [posterAddr, V3_CORE],
  });
  const needed = AMOUNT + STAKE;
  if (allowance >= needed) {
    console.log(`  allowance ok (${allowance} >= ${needed})`);
    return null;
  }
  console.log(`  approving ${needed} CELO to v3 core...`);
  const hash = await walletClient.writeContract({
    address: CELO_TOKEN, abi: ERC20_ABI, functionName: 'approve',
    args: [V3_CORE, needed * 10n], // approve 10x so next bounties don't re-approve
    account: walletClient.account, chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  approve tx: ${hash} (block ${receipt.blockNumber})`);
  return hash;
}

async function postBounty({ posterKey, posterAddr, targetAddr, issueUrl, issueNum, label }) {
  const account = privateKeyToAccount(posterKey);
  const walletClient = createWalletClient({ chain: celoMainnet, transport: http(RPC), account });

  const celoBalance = await publicClient.getBalance({ address: posterAddr });
  const celoTokenBalance = await publicClient.readContract({
    address: CELO_TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [posterAddr],
  });
  console.log(`\n[${label}] poster=${posterAddr}`);
  console.log(`  native CELO: ${Number(celoBalance) / 1e18}`);
  console.log(`  CELO ERC20:  ${Number(celoTokenBalance) / 1e18}`);

  await ensureAllowance(walletClient, posterAddr);

  console.log(`  posting direct-hire → ${targetAddr}, amount=1 CELO, stake=0.05...`);
  // Explicit gas to avoid viem over-estimating (Celo gas price ~200gwei ×5M=1CELO reserved,
  // making balance appear < amount during simulation).
  const hash = await walletClient.writeContract({
    address: V3_CORE,
    abi: CORE_ABI,
    functionName: 'postDirectHire',
    args: [
      CELO_TOKEN,
      targetAddr,
      0,          // bountyType = CODE
      REPO_URL,
      issueUrl,
      ZERO_HASH,
      AMOUNT,
      STAKE,
      DEADLINE,
    ],
    account,
    chain: walletClient.chain,
    gas: 480_000n,
    // Use exact baseFee as gasPrice (legacy mode) so gas reservation =
    // gasLimit × baseFee, not gasLimit × 2×baseFee (EIP-1559 default).
    gasPrice: 202_500_000_000n,
  });
  console.log(`  postDirectHire tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const events = parseEventLogs({ abi: CORE_ABI, eventName: 'BountyPosted', logs: receipt.logs });
  const bountyId = events[0]?.args?.bountyId;
  console.log(`  bountyId: ${bountyId} (block ${receipt.blockNumber})`);
  console.log(`  celoscan: https://celoscan.io/tx/${hash}`);
  return { hash, bountyId };
}

async function main() {
  console.log('=== Posting 3 SDK dev bounties on v3 mainnet ===\n');

  const b1 = await postBounty({
    posterKey: w1.key, posterAddr: w1.addr, targetAddr: w2.addr,
    issueUrl: 'https://github.com/yeheskieltame/claudelance/issues/386',
    issueNum: 386, label: 'B1 Error Classes (w1→w2)',
  });

  const b2 = await postBounty({
    posterKey: w2.key, posterAddr: w2.addr, targetAddr: w3.addr,
    issueUrl: 'https://github.com/yeheskieltame/claudelance/issues/387',
    issueNum: 387, label: 'B2 Event Watchers (w2→w3)',
  });

  const b3 = await postBounty({
    posterKey: w3.key, posterAddr: w3.addr, targetAddr: w1.addr,
    issueUrl: 'https://github.com/yeheskieltame/claudelance/issues/388',
    issueNum: 388, label: 'B3 List Filters (w3→w1)',
  });

  console.log('\n=== Summary ===');
  console.log(`B1 (Error Classes):   bountyId=${b1.bountyId}  tx=${b1.hash}`);
  console.log(`B2 (Event Watchers):  bountyId=${b2.bountyId}  tx=${b2.hash}`);
  console.log(`B3 (List Filters):    bountyId=${b3.bountyId}  tx=${b3.hash}`);
}

main().catch(err => { console.error(err); process.exit(1); });
