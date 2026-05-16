import { NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { MAINNET, SEPOLIA, type Deployment } from "@yeheskieltame/claudelance-types";

import { celoMainnet, celoSepolia } from "@/lib/chain";

export const revalidate = 30;

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=30, s-maxage=30",
};

type Params = Promise<{ id: string }>;

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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id: rawId } = await params;
  const bountyId = parseBountyId(rawId);
  if (!bountyId) {
    return NextResponse.json({ error: "id must be a positive bounty id" }, { status: 400, headers: corsHeaders });
  }

  const deployment = getActiveDeployment();
  const client = createPublicClient({
    chain: deployment.chainId === MAINNET.chainId ? celoMainnet : celoSepolia,
    transport: http(getRpcOverride(deployment.chainId)),
  });

  const totalCount = await client.readContract({
    address: deployment.core,
    abi: detailAbi,
    functionName: "bountyCount",
  });

  if (bountyId > totalCount) {
    return NextResponse.json({ error: "bounty not found" }, { status: 404, headers: corsHeaders });
  }

  const [bountyResult, claimersResult] = await client.multicall({
    allowFailure: false,
    contracts: [
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

  const bounty = normalizeBounty(bountyResult);
  const claimers = claimersResult as Address[];
  const submissionResults =
    claimers.length === 0
      ? []
      : await client.multicall({
          allowFailure: true,
          contracts: claimers.map((worker) => ({
            address: deployment.core,
            abi: detailAbi,
            functionName: "getSubmission",
            args: [bountyId, worker],
          })),
        });

  const submissions = submissionResults.flatMap((result, index) => {
    if (result.status !== "success") return [];

    const worker = claimers[index];
    if (!worker) return [];

    return [toJsonSubmission(worker, normalizeSubmission(result.result))];
  });

  return NextResponse.json(
    {
      ...toJsonBounty(bountyId, bounty),
      claimers,
      submissions,
      total: Number(totalCount),
    },
    { headers: corsHeaders },
  );
}

function parseBountyId(value: string) {
  try {
    const id = BigInt(value);
    return id >= 1n ? id : null;
  } catch {
    return null;
  }
}

function getActiveDeployment(): Deployment {
  return process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "celo-mainnet" ? MAINNET : SEPOLIA;
}

function getRpcOverride(chainId: number) {
  if (chainId === MAINNET.chainId) return process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;
  return process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC;
}

function toJsonBounty(id: bigint, bounty: ChainBounty) {
  return {
    id: id.toString(),
    poster: bounty.poster,
    amount: bounty.amount.toString(),
    winner: bounty.winner,
    stakeRequired: bounty.stakeRequired.toString(),
    token: bounty.token,
    deadline: bounty.deadline.toString(),
    maxSlots: Number(bounty.maxSlots),
    claimedSlots: Number(bounty.claimedSlots),
    bountyType: Number(bounty.bountyType),
    ciRequired: bounty.ciRequired,
    targetWorker: bounty.targetWorker,
    status: Number(bounty.status),
    targetRepoUrl: bounty.targetRepoUrl,
    instructionUrl: bounty.instructionUrl,
    requirementsHash: bounty.requirementsHash,
  };
}

function toJsonSubmission(worker: Address, submission: ChainSubmission) {
  return {
    worker,
    commitHash: submission.commitHash,
    submittedAt: submission.submittedAt.toString(),
    ciPassed: submission.ciPassed,
    stakeRefunded: submission.stakeRefunded,
    prUrl: submission.prUrl,
    metadata: submission.metadata,
  };
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
