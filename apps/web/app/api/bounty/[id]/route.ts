import { NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { MAINNET_V3, type Deployment } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "@/lib/chain";

// Short window: the detail page reads through with no-store, so this is the
// only cache layer between a fresh submission and the poster's screen.
export const revalidate = 5;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const detailAbi = [
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
          { name: "deliverableHash", type: "bytes32" },
          { name: "submittedAt", type: "uint64" },
          { name: "ciPassed", type: "bool" },
          { name: "stakeSettled", type: "bool" },
          { name: "deliverableUrl", type: "string" },
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
  // max-age=0: MiniPay's webview must not hold a pre-submission snapshot in
  // the browser cache; the short s-maxage keeps RPC load off the origin.
  "Cache-Control": "public, max-age=0, s-maxage=5",
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
  deliverableHash: `0x${string}`;
  submittedAt: bigint;
  ciPassed: boolean;
  stakeSettled: boolean;
  deliverableUrl: string;
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
    chain: celoMainnet,
    transport: http(getRpcOverride(deployment.chainId)),
  });

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
  // v3: getBounty returns zero struct for non-existent ids (no bountyCount getter).
  if (bounty.poster === ZERO_ADDRESS) {
    return NextResponse.json({ error: "bounty not found" }, { status: 404, headers: corsHeaders });
  }
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
  return MAINNET_V3;
}

function getRpcOverride(_chainId: number) {
  return process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;
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
    deliverableHash: submission.deliverableHash,
    submittedAt: submission.submittedAt.toString(),
    ciPassed: submission.ciPassed,
    stakeSettled: submission.stakeSettled,
    deliverableUrl: submission.deliverableUrl,
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
      deliverableHash: result[0] as `0x${string}`,
      submittedAt: result[1] as bigint,
      ciPassed: Boolean(result[2]),
      stakeSettled: Boolean(result[3]),
      deliverableUrl: String(result[4]),
      metadata: String(result[5]),
    };
  }

  return result as ChainSubmission;
}
