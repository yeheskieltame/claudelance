#!/usr/bin/env node
// Claudelance cUSD volume farmer - WINNER-BECOMES-POSTER CHAIN (open bounties).
// Each bounty: the current poster escrows a high reward, identity-workers claim
// the open slots, exactly ONE is picked winner, all withdraw. The winner keeps
// the reward (its stake margin covers the 2% fee, so it can self-fund) and
// becomes the POSTER of the next bounty. Claimers rotate across all workers, the
// winner rotates too -> maximum distinct posters + winners, high cUSD volume per
// bounty. Operator dogfooding.
//
// STRICT: every tx is status-checked; HARD-STOP on the first revert.
//
// Usage:
//   node scripts/cl-farm-cusd.mjs --validate                                  # 2-bounty chain
//   node scripts/cl-farm-cusd.mjs --workers 1-20 --amount 10 --slots 2 --stake 0.6 --waves 25
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, toHex, erc20Abi, getAddress } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { celo } = require('viem/chains');
const { ClaudelanceClient } = require(join(ROOT, 'packages/sdk/dist/index.cjs'));

const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a === '--validate') args.validate = true; else if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const VALIDATE = !!args.validate;
// --workers accepts "1,2,3" or a range "1-20"
function parseWorkerIds(s) { if (!s) return Array.from({ length: 12 }, (_, i) => String(i + 1)); if (s.includes('-')) { const [a, b] = s.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => String(a + i)); } return s.split(',').map((x) => x.trim()).filter(Boolean); }
const WORKER_IDS = parseWorkerIds(args.workers || (VALIDATE ? '1,2,3' : '1-20'));
const AMOUNT = parseEther(args.amount || (VALIDATE ? '1' : '10'));
const SLOTS = Number(args.slots || 2);
const STAKE = parseEther(args.stake || (VALIDATE ? '0.3' : '0.6')); // stake margin must exceed the 2% fee so the winner self-funds the next escrow
const WAVES = VALIDATE ? 2 : Number(args.waves || 25);

const RPC = 'https://forno.celo.org';
const CUSD = getAddress('0x765DE816845861e75A25fCA122bb6898B8B1282a');
const REPO = 'https://github.com/yeheskieltame/claudelance';
const PROOF = args.proof || 'https://bingochain.vercel.app';
const GAS_FLOOR = parseEther('0.4');
const FEE = { maxFeePerGas: 260000000000n, maxPriorityFeePerGas: 2000000000n };

const dkey = (() => { const k = readFileSync(join(ROOT, 'contracts/.env'), 'utf8').match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim(); return k.startsWith('0x') ? k : `0x${k}`; })();
const deployer = privateKeyToAccount(dkey);
const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const dWallet = createWalletClient({ account: deployer, chain: celo, transport: http(RPC) });
const dcl = ClaudelanceClient.fromPrivateKey({ privateKey: dkey, network: 'celo' });
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cusdBal = (a) => pub.readContract({ address: CUSD, abi: erc20Abi, functionName: 'balanceOf', args: [a] });

async function confirm(hashPromise, label) {
  const hash = await hashPromise;
  const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120000 });
  if (rc.status !== 'success') throw new Error(`REVERT at "${label}" (tx ${hash}) - STOPPING per careful mode`);
  log(`  ok: ${label}`);
  return rc;
}
const mkWorker = (id) => { const pk = readFileSync(join(ROOT, 'claudelance worker', `worker ${id}`, 'wallet.env'), 'utf8').match(/^PRIVATE_KEY=(.+)$/m)[1].trim(); const key = pk.startsWith('0x') ? pk : `0x${pk}`; const account = privateKeyToAccount(key); return { id, account, wallet: createWalletClient({ account, chain: celo, transport: http(RPC) }), cl: ClaudelanceClient.fromPrivateKey({ privateKey: key, network: 'celo' }) }; };

async function fund(addr, wantGas, wantCusd, nonceRef, tag) {
  if (addr.toLowerCase() === deployer.address.toLowerCase()) return; // deployer funds itself from its own balance
  if (wantGas > 0n) { const g = await pub.getBalance({ address: addr }); if (g < wantGas) await confirm(dWallet.sendTransaction({ to: addr, value: wantGas - g, gas: 21000n, nonce: nonceRef.n++, ...FEE }), `fund gas ${tag}`); }
  if (wantCusd > 0n) { const c = await cusdBal(addr); if (c < wantCusd) await confirm(dWallet.writeContract({ address: CUSD, abi: erc20Abi, functionName: 'transfer', args: [addr, wantCusd - c], gas: 80000n, nonce: nonceRef.n++, ...FEE }), `fund cUSD ${tag} (+${formatEther(wantCusd - c)})`); }
}

// One bounty in the chain. `poster` posts; `seats` claim; `seats[winnerIdx]` wins
// and is RETURNED as the next poster. Losers' stakes consolidate to the deployer.
async function runChainBounty(i, poster, seats, winnerIdx, amount, stake) {
  const pTag = poster.id ? `w${poster.id}` : 'deployer';
  log(`bounty ${i}: poster ${pTag} (${poster.account.address.slice(0, 8)}), reward ${formatEther(amount)} cUSD, claimers ${seats.map((w) => w.id).join(',')}, winner w${seats[winnerIdx].id}`);
  const nonceRef = { n: await pub.getTransactionCount({ address: deployer.address, blockTag: 'pending' }) };
  await fund(poster.account.address, GAS_FLOOR, amount, nonceRef, `poster ${pTag}`);
  for (const w of seats) await fund(w.account.address, GAS_FLOOR, stake, nonceRef, `claimer w${w.id}`);

  const { bountyId } = await poster.cl.postBountyAndGetId({ token: CUSD, bountyType: 10, targetRepoUrl: REPO, instructionUrl: PROOF, amount, maxSlots: seats.length, stake, deadlineSeconds: BigInt(2 * 86400), ciRequired: false });
  log(`  ok: posted open #${bountyId} by ${pTag}`);
  await sleep(3000);

  for (const w of seats) { await confirm(w.cl.claimSlotWithApproval(bountyId), `claim #${bountyId} w${w.id}`); await sleep(1500); }
  for (const w of seats) await confirm(w.cl.submitDeliverable(bountyId, { deliverableUrl: PROOF, deliverableHash: keccak256(toHex(`${PROOF}#${bountyId}-${w.id}`)), metadata: 'cusd-volume' }), `submit #${bountyId} w${w.id}`);
  const winner = seats[winnerIdx];
  await confirm(poster.cl.pickWinner(bountyId, winner.account.address), `pickWinner #${bountyId} -> w${winner.id}`);
  for (const w of seats) await confirm(dcl.settleStake(bountyId, w.account.address), `settleStake #${bountyId} w${w.id}`);
  for (const w of seats) { const res = await w.cl.withdrawAllEarnings([CUSD]); for (const { hash } of res) { const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120000 }); if (rc.status !== 'success') throw new Error(`REVERT withdraw #${bountyId} w${w.id}`); } log(`  ok: withdraw #${bountyId} w${w.id} (${res.length} tx)`); }

  // consolidate LOSERS' cUSD back to the deployer; the WINNER keeps its cUSD to post next
  for (const w of seats) { if (w === winner) continue; const b = await cusdBal(w.account.address); if (b > 0n) await confirm(w.wallet.writeContract({ address: CUSD, abi: erc20Abi, functionName: 'transfer', args: [deployer.address, b], gas: 80000n, ...FEE }), `consolidate loser w${w.id} (${formatEther(b)})`); }
  // the EX-poster keeps only its post-escrow excess (stake margin - fee); sweep it back so the deployer's stake-funding float doesn't slowly drain.
  if (poster.account.address.toLowerCase() !== deployer.address.toLowerCase()) { const pb = await cusdBal(poster.account.address); if (pb > 0n) await confirm(poster.wallet.writeContract({ address: CUSD, abi: erc20Abi, functionName: 'transfer', args: [deployer.address, pb], gas: 80000n, ...FEE }), `consolidate ex-poster w${poster.id} (${formatEther(pb)})`); }

  const vol = amount * 2n + stake * BigInt(seats.length) * 2n;
  log(`bounty ${i} #${bountyId} DONE: ~${formatEther(vol)} cUSD volume; winner w${winner.id} becomes next poster`);
  return { winner, vol };
}

(async () => {
  const workers = WORKER_IDS.map(mkWorker);
  const dC = await cusdBal(deployer.address); const dG = await pub.getBalance({ address: deployer.address });
  log(`cl-farm-cusd (WINNER-POSTER CHAIN): deployer ${formatEther(dC)} cUSD, ${formatEther(dG)} CELO; ${WAVES} bounties, ${SLOTS} slots, reward ${formatEther(AMOUNT)} + stake ${formatEther(STAKE)}, ${workers.length} workers`);
  const CELO_RESERVE = parseEther(args.celoReserve || '0.5');

  let poster = { account: deployer, wallet: dWallet, cl: dcl }; // bounty 0 poster = deployer
  let widx = 0, total = 0n, done = 0;
  for (let i = 0; i < WAVES; i++) {
    const gas = await pub.getBalance({ address: deployer.address });
    if (gas < CELO_RESERVE) { log(`stopping at bounty ${i}: deployer CELO ${formatEther(gas)} < reserve ${formatEther(CELO_RESERVE)}`); break; }
    const cusd = await cusdBal(deployer.address);
    if (cusd < STAKE * BigInt(SLOTS) + parseEther('0.3')) { log(`stopping at bounty ${i}: deployer cUSD ${formatEther(cusd)} can't fund stakes (need ${formatEther(STAKE * BigInt(SLOTS))} + buffer)`); break; }
    // pick SLOTS claimers (rotating), excluding the current poster
    const seats = [];
    let guard = 0;
    while (seats.length < SLOTS && guard < workers.length * 3) { const w = workers[widx % workers.length]; widx++; guard++; if (w.account.address.toLowerCase() !== poster.account.address.toLowerCase() && !seats.includes(w)) seats.push(w); }
    if (seats.length < SLOTS) { log(`not enough distinct claimers; stopping`); break; }
    const winnerIdx = i % seats.length; // rotate the winner across the claimers
    const r = await runChainBounty(i, poster, seats, winnerIdx, AMOUNT, STAKE);
    poster = r.winner; // winner becomes next poster
    total += r.vol; done++;
  }
  log(`cl-farm-cusd CHAIN DONE: ${done} bounties, ~${formatEther(total)} cUSD volume (in+out)`);
})().catch((e) => { console.error('\nSTOPPED ON ERROR:', e.message || e); process.exit(1); });
