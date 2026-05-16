import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { BountyStatus, MAINNET, SEPOLIA, type Deployment } from "@yeheskieltame/claudelance-types";

import { celoMainnet, celoSepolia } from "@/lib/chain";

export const revalidate = 30;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const BATCH_SIZE = 25;

const bountiesApiAbi = [
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
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=30, s-maxage=30",
};

type StatusFilter = "open" | "resolved";
type TokenFilter = "cusd" | "celo" | "usdc";

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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const parsed = parseQuery(request.nextUrl.searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: corsHeaders });
  }

  const deployment = getActiveDeployment();
  const client = createPublicClient({
    chain: deployment.chainId === MAINNET.chainId ? celoMainnet : celoSepolia,
    transport: http(getRpcOverride(deployment.chainId)),
  });

  const totalCount = await client.readContract({
    address: deployment.core,
    abi: bountiesApiAbi,
    functionName: "bountyCount",
  });

  const items: ReturnType<typeof toJsonBounty>[] = [];
  let nextId = parsed.cursor;

  while (nextId <= totalCount && items.length < parsed.limit) {
    const batchSize = Number(minBigInt(BigInt(BATCH_SIZE), totalCount - nextId + 1n));
    const ids = Array.from({ length: batchSize }, (_, index) => nextId + BigInt(index));

    const results = await client.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({
        address: deployment.core,
        abi: bountiesApiAbi,
        functionName: "getBounty",
        args: [id],
      })),
    });

    let nextPageCursor: bigint | null = null;
    for (const [index, result] of results.entries()) {
      if (result.status !== "success") continue;

      const id = ids[index];
      if (!id) continue;

      const bounty = normalizeBounty(result.result);
      if (!matchesStatus(bounty, parsed.status)) continue;
      if (!matchesToken(bounty, parsed.token, deployment)) continue;

      items.push(toJsonBounty(id, bounty));
      if (items.length >= parsed.limit) {
        nextPageCursor = id + 1n;
        break;
      }
    }

    if (nextPageCursor) {
      nextId = nextPageCursor;
      break;
    }

    nextId += BigInt(batchSize);
  }

  return NextResponse.json(
    {
      items,
      nextCursor: nextId <= totalCount ? nextId.toString() : null,
      total: Number(totalCount),
    },
    { headers: corsHeaders },
  );
}

function parseQuery(searchParams: URLSearchParams):
  | {
      status?: StatusFilter;
      token?: TokenFilter;
      limit: number;
      cursor: bigint;
    }
  | { error: string } {
  const status = searchParams.get("status")?.toLowerCase();
  if (status && status !== "open" && status !== "resolved") {
    return { error: "status must be open or resolved" };
  }

  const token = searchParams.get("token")?.toLowerCase();
  if (token && token !== "cusd" && token !== "celo" && token !== "usdc") {
    return { error: "token must be cusd, celo, or usdc" };
  }

  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `limit must be an integer from 1 to ${MAX_LIMIT}` };
  }

  const cursorRaw = searchParams.get("cursor");
  let cursor: bigint;
  try {
    cursor = cursorRaw ? BigInt(cursorRaw) : 1n;
  } catch {
    return { error: "cursor must be a positive bounty id" };
  }
  if (cursor < 1n) {
    return { error: "cursor must be a positive bounty id" };
  }

  return {
    status: status as StatusFilter | undefined,
    token: token as TokenFilter | undefined,
    limit,
    cursor,
  };
}

function getActiveDeployment(): Deployment {
  return process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "celo-mainnet" ? MAINNET : SEPOLIA;
}

function getRpcOverride(chainId: number) {
  if (chainId === MAINNET.chainId) return process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;
  return process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC;
}

function matchesStatus(bounty: ChainBounty, status?: StatusFilter) {
  if (!status) return true;
  return bounty.status === (status === "open" ? BountyStatus.Open : BountyStatus.Resolved);
}

function matchesToken(bounty: ChainBounty, token: TokenFilter | undefined, deployment: Deployment) {
  if (!token) return true;

  const tokenAddress =
    token === "cusd"
      ? deployment.tokens.cUSD
      : token === "celo"
        ? deployment.tokens.CELO
        : deployment.tokens.USDC;

  return bounty.token.toLowerCase() === tokenAddress.toLowerCase();
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

function minBigInt(a: bigint, b: bigint) {
  return a < b ? a : b;
}
