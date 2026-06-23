#!/usr/bin/env node
import { createPublicClient, http, formatUnits, formatEther } from "viem";
import { celo } from "viem/chains";

const CORE = "0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423";
const CELO_TOKEN = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const CUSD_TOKEN = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const USDC_TOKEN = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

const STATUS = ["Open", "Resolved", "Cancelled", "Expired"];

const tokenName = (a) => {
  const l = a.toLowerCase();
  if (l === CELO_TOKEN.toLowerCase()) return "CELO";
  if (l === CUSD_TOKEN.toLowerCase()) return "cUSD";
  if (l === USDC_TOKEN.toLowerCase()) return "USDC";
  return a;
};

const ABI = [
  {
    type: "function",
    name: "bountyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getBounty",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "poster", type: "address" },
          { name: "amount", type: "uint96" },
          { name: "winner", type: "address" },
          { name: "stakeRequired", type: "uint96" },
          { name: "token", type: "address" },
          { name: "deadline", type: "uint64" },
          { name: "maxSlots", type: "uint8" },
          { name: "claimedSlots", type: "uint8" },
          { name: "bountyType", type: "uint8" },
          { name: "ciRequired", type: "bool" },
          { name: "targetWorker", type: "address" },
          { name: "status", type: "uint8" },
          { name: "targetRepoUrl", type: "string" },
          { name: "instructionUrl", type: "string" },
          { name: "requirementsHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "earnings",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

const client = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});

const fmt = (amount, token) => {
  const decimals = tokenName(token) === "USDC" ? 6 : 18;
  return formatUnits(amount, decimals);
};

async function main() {
  const count = await client.readContract({
    address: CORE,
    abi: ABI,
    functionName: "bountyCount",
  });
  console.log(`bountyCount = ${count}`);

  const unresolved = [];
  let lockedCELO = 0n;
  let lockedCUSD = 0n;
  let lockedUSDC = 0n;

  for (let i = 1n; i <= count; i++) {
    const b = await client.readContract({
      address: CORE,
      abi: ABI,
      functionName: "getBounty",
      args: [i],
    });
    if (b.status === 0 || b.status === 3) {
      // Open or Expired (still holds funds)
      unresolved.push({ id: i, b });
      const locked = b.amount + BigInt(b.stakeRequired) * BigInt(b.claimedSlots);
      if (b.token.toLowerCase() === CELO_TOKEN.toLowerCase()) lockedCELO += locked;
      if (b.token.toLowerCase() === CUSD_TOKEN.toLowerCase()) lockedCUSD += locked;
      if (b.token.toLowerCase() === USDC_TOKEN.toLowerCase()) lockedUSDC += locked;
    }
  }

  console.log(`\nUnresolved bounties (Open + Expired): ${unresolved.length}`);
  console.log("=".repeat(100));
  const now = Math.floor(Date.now() / 1000);
  for (const { id, b } of unresolved) {
    const ddl = Number(b.deadline);
    const overdue = ddl < now ? `OVERDUE by ${((now - ddl) / 86400).toFixed(1)}d` : `${((ddl - now) / 86400).toFixed(1)}d left`;
    console.log(
      `#${id}  status=${STATUS[b.status]}  token=${tokenName(b.token)}  amount=${fmt(b.amount, b.token)}  stake=${fmt(b.stakeRequired, b.token)}*${b.claimedSlots}claims  deadline=${new Date(ddl * 1000).toISOString().slice(0, 16)} (${overdue})`
    );
    console.log(`   repo=${b.targetRepoUrl}`);
    console.log(`   spec=${b.instructionUrl}`);
    console.log(`   targetWorker=${b.targetWorker}  poster=${b.poster}`);
    console.log();
  }

  console.log("=".repeat(100));
  console.log(`Locked in unresolved bounties:`);
  console.log(`  CELO: ${formatEther(lockedCELO)}`);
  console.log(`  cUSD: ${formatEther(lockedCUSD)}`);
  console.log(`  USDC: ${formatUnits(lockedUSDC, 6)}`);

  // Also check protocol revenue + treasury earnings sitting unwithdrawn
  const TREASURY = "0xCC0cCac212999612BdDdEb607B33CC1a46F8A401";
  const treasuryCelo = await client.readContract({
    address: CORE,
    abi: ABI,
    functionName: "earnings",
    args: [TREASURY, CELO_TOKEN],
  });
  console.log(`\nTreasury earnings unwithdrawn (CELO): ${formatEther(treasuryCelo)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
