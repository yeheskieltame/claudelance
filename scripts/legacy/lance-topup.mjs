#!/usr/bin/env node
// Top up the deployer's $LANCE by depositing CELO into the LanceHub ERC-4626
// vault. This MINTS new $LANCE at the current NAV (NAV-neutral - does not change
// the rate), keeping $LANCE cheap for dev/dogfood distribution. Posting bounties
// in $LANCE drains the deployer ~110/bounty; refill when it runs low.
// Usage: node scripts/lance-topup.mjs [celoAmount=1]   → ~celoAmount*1000 $LANCE
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "packages/sdk/package.json"));
const { createPublicClient, createWalletClient, http, parseEther, formatEther, parseGwei, getAddress } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { celo } = require("viem/chains");

const RPC = "https://forno.celo.org";
const LANCE = getAddress("0xb70c9Cd73428Afe51eEEA832C49E8840D3f85cA2"); // LanceHub vault + share token
const CELO = getAddress("0x471EcE3750Da237f93B8E339c536989b8978a438"); // CELO ERC20 = vault asset
const FEE = { maxFeePerGas: parseGwei("260"), maxPriorityFeePerGas: parseGwei("2") };
const AMT = parseEther(process.argv[2] || "1");

const ERC20 = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];
const HUB = [{ type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] }];

const key = readFileSync(join(ROOT, "contracts/.env"), "utf8").match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const acct = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const wallet = createWalletClient({ account: acct, chain: celo, transport: http(RPC) });

const before = await pub.readContract({ address: LANCE, abi: ERC20, functionName: "balanceOf", args: [acct.address] });
console.log(`LANCE before: ${formatEther(before)} | depositing ${formatEther(AMT)} CELO`);

const allow = await pub.readContract({ address: CELO, abi: ERC20, functionName: "allowance", args: [acct.address, LANCE] });
if (allow < AMT) {
  const h = await wallet.writeContract({ address: CELO, abi: ERC20, functionName: "approve", args: [LANCE, AMT], gas: 80000n, ...FEE });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`approved ${formatEther(AMT)} CELO to LanceHub`);
}

const dh = await wallet.writeContract({ address: LANCE, abi: HUB, functionName: "deposit", args: [AMT, acct.address], gas: 500000n, ...FEE });
const r = await pub.waitForTransactionReceipt({ hash: dh });
const after = await pub.readContract({ address: LANCE, abi: ERC20, functionName: "balanceOf", args: [acct.address] });
console.log(`deposit ${r.status} tx=${dh}`);
console.log(`LANCE after: ${formatEther(after)} (+${formatEther(after - before)})`);
