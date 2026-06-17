import "server-only";

import { createPublicClient, http, zeroAddress, type Address } from "viem";

import { celoMainnet } from "@/lib/chain";
import { getDeployment } from "@/lib/contracts";

const rpcOverride = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;

/** BountyStatus.Resolved (Open=0, Resolved=1, ...). */
const STATUS_RESOLVED = 1;
const PROTOCOL_FEE_BPS = 200n;
const BPS_DENOMINATOR = 10_000n;

// Minimal getBounty view ABI (same tuple shape as the deployed v3 struct).
const coreAbi = [
  {
    type: "function",
    name: "getBounty",
    inputs: [{ name: "bountyId", type: "uint256" }],
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
          { name: "requirementsHash", type: "bytes32" },
          { name: "targetRepoUrl", type: "string" },
          { name: "instructionUrl", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

export type WorkerHistoryRow = {
  bountyId: bigint;
  winnerPayout: bigint;
  token: Address;
};

/** Net payout the winner received, matching the contract's fee math. */
function netPayout(amount: bigint): bigint {
  return amount - (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
}

/**
 * Bounties this worker won, read straight from contract state via
 * getBounty(1..N) in multicall batches. Mirrors the leaderboard's approach: a
 * getLogs window over the full history is rejected by most RPCs, which is why
 * the per-worker history used to come back empty.
 */
export async function fetchWorkerHistory(worker: Address): Promise<WorkerHistoryRow[]> {
  const client = createPublicClient({ chain: celoMainnet, transport: http(rpcOverride) });
  const core = getDeployment(celoMainnet.id).core as Address;
  const target = worker.toLowerCase();

  const BATCH = 50;
  const MAX_SCAN = 5_000;
  const rows: WorkerHistoryRow[] = [];
  let scanId = 1;
  while (scanId <= MAX_SCAN) {
    const batchIds = Array.from(
      { length: Math.min(BATCH, MAX_SCAN - scanId + 1) },
      (_, i) => BigInt(scanId + i),
    );
    const batch = await client.multicall({
      allowFailure: true,
      contracts: batchIds.map((id) => ({
        address: core,
        abi: coreAbi,
        functionName: "getBounty" as const,
        args: [id] as const,
      })),
    });
    let hasAny = false;
    batch.forEach((res, i) => {
      if (res.status !== "success") return;
      const b = res.result as {
        poster: string;
        winner: Address;
        amount: bigint;
        token: Address;
        status: number;
      };
      if (b.poster && b.poster !== zeroAddress) hasAny = true;
      if (b.status === STATUS_RESOLVED && b.winner.toLowerCase() === target) {
        rows.push({ bountyId: batchIds[i]!, winnerPayout: netPayout(b.amount), token: b.token });
      }
    });
    scanId += batchIds.length;
    if (!hasAny) break; // scanned past the last bounty
  }

  return rows.sort((a, b) => Number(b.bountyId - a.bountyId));
}
