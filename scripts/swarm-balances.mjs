#!/usr/bin/env node
// Snapshot native CELO + cUSD + USDC balances and v2/v3 in-contract earnings
// for the 30 local workers plus the deployer. Read-only.
// Run from repo root: node scripts/swarm-balances.mjs
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const require = createRequire(join(ROOT, 'packages/sdk/package.json'));
const { createPublicClient, http, formatEther, formatUnits } = require('viem');

const RPC = 'https://forno.celo.org';
const CUSD = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const USDC = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C';
const V2_CORE = '0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423';
const DEPLOYER = '0x77c4a1cD22005b67Eb9CcEaE7E9577188d7Bca82';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];
const V2_ABI = [
  { name: 'earnings', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const client = createPublicClient({
  chain: { id: 42220, name: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } },
  transport: http(RPC),
});

function loadAddr(n) {
  const f = readFileSync(join(ROOT, 'claudelance worker', `worker ${n}`, 'wallet.env'), 'utf8');
  return f.match(/^ADDRESS=(.+)$/m)[1].trim();
}

const RELAYER = '0x1fEDda23c2945D59f3929e6C463cF685aC077ad5';

const rows = [];
for (let n = 1; n <= 30; n++) rows.push({ id: `w${n}`, addr: loadAddr(n) });
rows.push({ id: 'deployer', addr: DEPLOYER });
// The Railway keeper signs from this wallet; below ~0.3 CELO its sends fail
// the node's upfront balance check and settles/attests silently stall.
rows.push({ id: 'keeper', addr: RELAYER });

let totalCelo = 0n, totalCusd = 0n, totalUsdc = 0n;
for (const r of rows) {
  const [celo, cusd, usdc, e2cusd, e2usdc] = await Promise.all([
    client.getBalance({ address: r.addr }),
    client.readContract({ address: CUSD, abi: ERC20_ABI, functionName: 'balanceOf', args: [r.addr] }),
    client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [r.addr] }),
    client.readContract({ address: V2_CORE, abi: V2_ABI, functionName: 'earnings', args: [r.addr, CUSD] }),
    client.readContract({ address: V2_CORE, abi: V2_ABI, functionName: 'earnings', args: [r.addr, USDC] }),
  ]);
  if (r.id.startsWith('w')) { totalCelo += celo; totalCusd += cusd; totalUsdc += usdc; }
  const flag = (e2cusd > 0n || e2usdc > 0n) ? ' V2-EARNINGS!' : '';
  console.log(`${r.id.padEnd(9)} ${r.addr} CELO=${Number(formatEther(celo)).toFixed(4).padStart(10)} cUSD=${Number(formatEther(cusd)).toFixed(4).padStart(9)} USDC=${Number(formatUnits(usdc, 6)).toFixed(4).padStart(9)}${flag}`);
}
console.log('---');
console.log(`workers total: CELO=${formatEther(totalCelo)} cUSD=${formatEther(totalCusd)} USDC=${formatUnits(totalUsdc, 6)}`);
