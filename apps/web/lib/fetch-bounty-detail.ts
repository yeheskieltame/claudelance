/**
 * Server-side data fetcher for a single bounty's full detail.
 *
 * PERFORMANCE:
 *  - Eliminates the HTTP self-fetch hop that page.tsx previously used.
 *  - Merges bountyCount + getBounty + getClaimers into a SINGLE multicall
 *    (was 2 sequential round-trips in the API route).
 *  - Submission reads remain a second multicall (unavoidable — claimer list
 *    must be known first), but all submissions are fetched in parallel.
 *
 * Used by:
 *  - app/bounty/[id]/page.tsx (server component, direct call — no HTTP)
 *  - app/api/bounty/[id]/route.ts can import this too if needed externally
 */

import { createPublicClient, http, type Address } from "viem";
import { MAINNET, SEPOLIA, type Deployment } from "@yeheskieltame/claudelance-types";

import { celoMainnet, celoSepolia } from "./chain";
import { tokenToUsd } from "./usd-conversion";

// ── ABI (minimal) ─────────────────────────────────────────────────────────────
const detailAbi = [
  {
    type: "function",
    name: "bountyCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
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
          { name: "targetRepoUrl", type: "string" },
          { name: "instructionUrl", type: "string" },
          { name: "requirementsHash", type: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getClaimers",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubmission",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "worker", type: "address" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "commitHash", type: "bytes32" },
          { name: "submittedAt", type: "uint64" },
          { name: "ciPassed", type: "bool" },
          { name: "stakeRefunded", type: "bool" },
          { name: "prUrl", type: "string" },
          { name: "metadata", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────
type ChainBounty = {
  poster: Address;
  amount: bigint;
  winner: Address;
  stakeRequired: bigint;
  token: Address;
  deadline: bigint;
  maxSlots: number;
  claimedSlots: number;
  bountyType: number;
  ciRequired: boolean;
  targetWorker: Address;
  status: number;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash: `0x${string}`;
};

type ChainSubmission = {
  commitHash: `0x${string}`;
  submittedAt: bigint;
  ciPassed: boolean;
  stakeRefunded: boolean;
  prUrl: string;
  metadata: string;
};

export type BountyDetail = {
  id: string;
  poster: string;
  amount: string;
  amountUsd: number;
  tokenSymbol: "cUSD" | "CELO" | "USDC";
  winner: string;
  stakeRequired: string;
  token: string;
  deadline: string;
  isExpired: boolean;
  slotsRemaining: number;
  maxSlots: number;
  claimedSlots: number;
  bountyType: number;
  ciRequired: boolean;
  targetWorker: string;
  status: number;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash: string;
  claimers: string[];
  submissions: Submission[];
  total: number;
};

export type Submission = {
  worker: string;
  commitHash: string;
  submittedAt: string;
  ciPassed: boolean;
  stakeRefunded: boolean;
  prUrl: string;
  metadata: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function getDeployment(): Deployment {
  return process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "celo-mainnet" ? MAINNET : SEPOLIA;
}

function getRpc(chainId: number) {
  return chainId === MAINNET.chainId
    ? process.env.NEXT_PUBLIC_CELO_MAINNET_RPC
    : process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC;
}

function resolveTokenSymbol(
  tokenAddress: string,
  deployment: Deployment,
): "cUSD" | "CELO" | "USDC" {
  const addr = tokenAddress.toLowerCase();
  if (addr === deployment.tokens.cUSD.toLowerCase()) return "cUSD";
  if (addr === deployment.tokens.CELO.toLowerCase()) return "CELO";
  return "USDC";
}

function normalizeBounty(result: unknown): ChainBounty {
  if (Array.isArray(result)) {
    return {
      poster: result[0] as Address,
      amount: result[1] as bigint,
      winner: result[2] as Address,
      stakeRequired: result[3] as bigint,
      token: result[4] as Address,
      deadline: result[5] as bigint,
      maxSlots: Number(result[6]),
      claimedSlots: Number(result[7]),
      bountyType: Number(result[8]),
      ciRequired: Boolean(result[9]),
      targetWorker: result[10] as Address,
      status: Number(result[11]),
      targetRepoUrl: String(result[12]),
      instructionUrl: String(result[13]),
      requirementsHash: result[14] as `0x${string}`,
    };
  }
  return result as ChainBounty;
}

function normalizeSubmission(result: unknown): ChainSubmission {
  if (Array.isArray(result)) {
    return {
      commitHash: result[0] as `0x${string}`,
      submittedAt: result[1] as bigint,
      ciPassed: Boolean(result[2]),
      stakeRefunded: Boolean(result[3]),
      prUrl: String(result[4]),
      metadata: String(result[5]),
    };
  }
  return result as ChainSubmission;
}

// ── Main export ────────────────────────────────────────────────────────────────
/**
 * Fetch a full bounty detail directly from the RPC.
 * Uses 2 multicall batches (instead of 3 sequential reads):
 *   Batch 1: bountyCount + getBounty + getClaimers  (1 round-trip)
 *   Batch 2: getSubmission × N                       (1 round-trip, parallel)
 *
 * Returns null if the bounty id is out of range.
 */
export async function fetchBountyDetail(id: string): Promise<BountyDetail | null> {
  let bountyId: bigint;
  try {
    bountyId = BigInt(id);
    if (bountyId < 1n) return null;
  } catch {
    return null;
  }

  const deployment = getDeployment();
  const client = createPublicClient({
    chain: deployment.chainId === MAINNET.chainId ? celoMainnet : celoSepolia,
    transport: http(getRpc(deployment.chainId)),
  });

  // ── Batch 1: count + bounty + claimers in one multicall ────────────────────
  const [countResult, bountyResult, claimersResult] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: deployment.core,
        abi: detailAbi,
        functionName: "bountyCount",
      },
      {
        address: deployment.core,
        abi: detailAbi,
        functionName: "getBounty",
        args: [bountyId],
      },
      {
        address: deployment.core,
        abi: detailAbi,
        functionName: "getClaimers",
        args: [bountyId],
      },
    ],
  });

  const totalCount = countResult as bigint;
  if (bountyId > totalCount) return null;

  const bounty = normalizeBounty(bountyResult);
  const claimers = claimersResult as Address[];

  // ── Batch 2: submissions (parallel per claimer) ────────────────────────────
  const submissionResults =
    claimers.length === 0
      ? []
      : await client.multicall({
          allowFailure: true,
          contracts: claimers.map((worker) => ({
            address: deployment.core,
            abi: detailAbi,
            functionName: "getSubmission" as const,
            args: [bountyId, worker] as const,
          })),
        });

  const submissions: Submission[] = submissionResults.flatMap((result, index) => {
    if (result.status !== "success") return [];
    const worker = claimers[index];
    if (!worker) return [];
    const sub = normalizeSubmission(result.result);
    return [
      {
        worker,
        commitHash: sub.commitHash,
        submittedAt: sub.submittedAt.toString(),
        ciPassed: sub.ciPassed,
        stakeRefunded: sub.stakeRefunded,
        prUrl: sub.prUrl,
        metadata: sub.metadata,
      },
    ];
  });

  const tokenSymbol = resolveTokenSymbol(bounty.token, deployment);
  const amountUsd = tokenToUsd(tokenSymbol, bounty.amount);
  const isExpired =
    bounty.deadline > 0n && BigInt(Math.floor(Date.now() / 1000)) > bounty.deadline;

  return {
    id: bountyId.toString(),
    poster: bounty.poster,
    amount: bounty.amount.toString(),
    amountUsd: Number(amountUsd.toFixed(4)),
    tokenSymbol,
    winner: bounty.winner,
    stakeRequired: bounty.stakeRequired.toString(),
    token: bounty.token,
    deadline: bounty.deadline.toString(),
    isExpired,
    slotsRemaining: Math.max(0, bounty.maxSlots - bounty.claimedSlots),
    maxSlots: bounty.maxSlots,
    claimedSlots: bounty.claimedSlots,
    bountyType: bounty.bountyType,
    ciRequired: bounty.ciRequired,
    targetWorker: bounty.targetWorker,
    status: bounty.status,
    targetRepoUrl: bounty.targetRepoUrl,
    instructionUrl: bounty.instructionUrl,
    requirementsHash: bounty.requirementsHash,
    claimers: claimers as string[],
    submissions,
    total: Number(totalCount),
  };
}
