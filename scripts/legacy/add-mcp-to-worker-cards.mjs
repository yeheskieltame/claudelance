#!/usr/bin/env node
// Declare the marketplace MCP service on every worker agent card (9061-9090) so
// 8004scan health-checks MCP per worker → Service dimension up across the swarm.
// Funds each worker's gas just-in-time from the deployer, then setAgentURI from
// the worker's own key. Idempotent: skips a card that already lists MCP.
// Sweep leftover gas back afterwards with scripts/consolidate-workers.mjs.
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const require = createRequire(join(ROOT, "packages/sdk/package.json"));
const { createWalletClient, createPublicClient, http, parseGwei, parseEther, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { celo } = require("viem/chains");

const RPC = "https://forno.celo.org"; // forno for writes (dRPC rejects sendRawTx); getLogs not used here
const IDENTITY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ABI = [
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "setAgentURI", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "string" }], outputs: [] },
];
const MCP = {
  name: "MCP",
  endpoint: "https://claudelance.xyz/mcp",
  version: "1.0.0",
  mcpTools: ["list_bounties", "get_bounty", "get_stats", "list_swarm", "get_worker"],
};
const FEE = { maxFeePerGas: parseGwei("300"), maxPriorityFeePerGas: parseGwei("2") };
const GAS_FLOOR = parseEther("0.35");

const deployerKey = readFileSync(join(ROOT, "contracts/.env"), "utf8").match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const deployer = privateKeyToAccount(deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`);
const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const dep = createWalletClient({ account: deployer, chain: celo, transport: http(RPC) });

let done = 0, skipped = 0, failed = 0;
for (let i = 1; i <= 30; i++) {
  let wf;
  try {
    wf = readFileSync(join(ROOT, "claudelance worker", `worker ${i}`, "wallet.env"), "utf8");
  } catch {
    continue;
  }
  const addr = wf.match(/^ADDRESS=(.+)$/m)[1].trim();
  const pk = wf.match(/^PRIVATE_KEY=(.+)$/m)[1].trim();
  const agentId = BigInt(9060 + i);
  try {
    const cur = await pub.readContract({ address: IDENTITY, abi: ABI, functionName: "tokenURI", args: [agentId] });
    if (!cur || !cur.includes("base64,")) {
      console.log(`w${i} (${agentId}) card not a data-URI - skip`);
      skipped++;
      continue;
    }
    const card = JSON.parse(Buffer.from(cur.split("base64,")[1], "base64").toString());
    if ((card.services || []).some((s) => (s.name || "").toUpperCase() === "MCP")) {
      console.log(`w${i} (${agentId}) already has MCP - skip`);
      skipped++;
      continue;
    }
    const bal = await pub.getBalance({ address: addr });
    if (bal < GAS_FLOOR) {
      const h = await dep.sendTransaction({ to: addr, value: GAS_FLOOR - bal, ...FEE });
      await pub.waitForTransactionReceipt({ hash: h });
    }
    card.services = card.services || [];
    card.services.unshift(MCP);
    const newURI = "data:application/json;base64," + Buffer.from(JSON.stringify(card)).toString("base64");
    const wal = createWalletClient({ account: privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`), chain: celo, transport: http(RPC) });
    const hash = await wal.writeContract({ address: IDENTITY, abi: ABI, functionName: "setAgentURI", args: [agentId, newURI], gas: 600_000n, ...FEE });
    const r = await pub.waitForTransactionReceipt({ hash });
    console.log(`w${i} (${agentId}) MCP set - status=${r.status} gas=${r.gasUsed}`);
    done++;
  } catch (e) {
    console.log(`w${i} (${agentId}) FAILED: ${(e.shortMessage || e.message).slice(0, 90)}`);
    failed++;
  }
}
console.log(`\ndone=${done} skipped=${skipped} failed=${failed}`);
