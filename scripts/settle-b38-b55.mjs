#!/usr/bin/env node
// settle-b38-b55.mjs - cancelExpired for all 15 stuck bounties (IDs 38-55)
// then off-protocol CELO ERC20 payment to the two declared winners.
//
// Usage:
//   MAINNET_DEPLOYER_PRIVATE_KEY=<key> node scripts/settle-b38-b55.mjs
//
// Requires MAINNET_DEPLOYER_PRIVATE_KEY in env (same var as fund-workers.sh).

import { createWalletClient, createPublicClient, http, parseAbi, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const CORE      = "0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423";
const CELO_ERC20 = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const RPC       = process.env.CELO_RPC ?? "https://forno.celo.org";

// All expired public-round bounty IDs from B38-B55 (bountyId 39 is the blank entry)
const CANCEL_IDS = [38n, 39n, 40n, 42n, 43n, 44n, 47n, 48n, 49n, 50n, 51n, 52n, 53n, 54n, 55n];

// Off-protocol payouts: winners who gave wallet addresses but never completed on-chain flow
const PAYMENTS = [
  {
    label:  "sypham98-prog (B40 bountyId=40 + B51 bountyId=47)",
    issues: ["#137", "#148"],
    to:     "0x1CA3305Ca47f152a2fE4667ccF5F56B3E2589182",
    amount: parseEther("2"),
  },
  {
    label:  "jeasop0301 (B39 bountyId=50 + B50 bountyId=53)",
    issues: ["#136", "#147"],
    to:     "0xb9a804Db055639e43938B9DbF66C3e76C1B70B53",
    amount: parseEther("2"),
  },
];

const coreAbi = parseAbi([
  "function cancelExpired(uint256 bountyId) external",
  "function withdrawEarnings(address token) external",
]);
const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

const pk = process.env.MAINNET_DEPLOYER_PRIVATE_KEY;
if (!pk) {
  console.error("Error: MAINNET_DEPLOYER_PRIVATE_KEY not set");
  process.exit(1);
}

const account = privateKeyToAccount(`0x${pk.replace(/^0x/, "")}`);
const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) });
const publicClient = createPublicClient({ chain: celo, transport: http(RPC) });

async function sendAndWait(hash, label) {
  console.log(`  sent ${label}: https://celoscan.io/tx/${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  confirmed: ${label}`);
  return hash;
}

async function main() {
  console.log("Signer:", account.address);
  console.log("RPC:", RPC);
  console.log();

  // ── Step 1: cancelExpired for all 15 expired bounties ──────────────────────
  console.log(`=== Step 1: cancelExpired (${CANCEL_IDS.length} bounties) ===`);
  for (const id of CANCEL_IDS) {
    try {
      const hash = await walletClient.writeContract({
        address: CORE,
        abi: coreAbi,
        functionName: "cancelExpired",
        args: [id],
      });
      await sendAndWait(hash, `cancelExpired(${id})`);
    } catch (err) {
      console.warn(`  SKIP bountyId=${id}: ${err.shortMessage ?? err.message}`);
    }
  }

  // ── Step 1.5: withdrawEarnings to pull cancelled escrow back to wallet ────
  console.log();
  console.log("=== Step 1.5: withdrawEarnings(CELO_ERC20) ===");
  try {
    const wdHash = await walletClient.writeContract({
      address: CORE,
      abi: coreAbi,
      functionName: "withdrawEarnings",
      args: [CELO_ERC20],
    });
    await sendAndWait(wdHash, "withdrawEarnings(CELO_ERC20)");
  } catch (err) {
    console.warn(`  SKIP withdrawEarnings: ${err.shortMessage ?? err.message}`);
  }

  const balance = await publicClient.readContract({
    address: CELO_ERC20,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`  CELO ERC20 balance after withdraw: ${Number(balance) / 1e18} CELO`);

  // ── Step 2: off-protocol CELO ERC20 payment to winners ────────────────────
  console.log();
  console.log("=== Step 2: Pay winners (CELO ERC20 off-protocol) ===");
  const payHashes = [];
  for (const p of PAYMENTS) {
    const hash = await walletClient.writeContract({
      address: CELO_ERC20,
      abi: erc20Abi,
      functionName: "transfer",
      args: [p.to, p.amount],
    });
    await sendAndWait(hash, `2 CELO → ${p.label}`);
    payHashes.push({ ...p, hash });
  }

  // ── Summary for GitHub comments ────────────────────────────────────────────
  console.log();
  console.log("=== PAYMENT SUMMARY (paste into GitHub comments) ===");
  for (const { label, issues, to, hash } of payHashes) {
    console.log();
    console.log(`Winner : ${label}`);
    console.log(`Address: ${to}`);
    console.log(`Issues : ${issues.join(", ")}`);
    console.log(`TX     : https://celoscan.io/tx/${hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
