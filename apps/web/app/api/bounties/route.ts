import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { BountyStatus, MAINNET_V3, type Deployment } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "@/lib/chain";

export const revalidate = 30;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const BATCH_SIZE = 25;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// v3 does not expose bountyCount() as a public getter (EIP-7201 storage).
// We scan in batches and stop when a full batch returns only zero-address posters.
const MAX_SCAN_ID = 100_000n;

const bountiesApiAbi = [
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=30, s-maxage=30",
};

type StatusFilter = "open" | "resolved" | "cancelled" | "expired";
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
    chain: celoMainnet,
    transport: http(getRpcOverride(deployment.chainId)),
  });

  const items: ReturnType<typeof toJsonBounty>[] = [];
  let nextId = parsed.cursor;

  // v3: scan in batches; stop when a batch returns all zero-address posters (past max id).
  while (nextId <= MAX_SCAN_ID && items.length < parsed.limit) {
    const batchSize = BATCH_SIZE;
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
    let nonEmptyInBatch = 0;

    for (const [index, result] of results.entries()) {
      const id = ids[index];
      if (!id) continue;

      if (result.status !== "success") continue;
      const bounty = normalizeBounty(result.result);

      // Zero-address poster = bounty doesn't exist (v3 returns zero struct for missing ids).
      if (bounty.poster === ZERO_ADDRESS) continue;
      nonEmptyInBatch++;

      if (!matchesStatus(bounty, parsed.status)) continue;
      if (!matchesToken(bounty, parsed.token, deployment)) continue;

      items.push(toJsonBounty(id, bounty));
      if (items.length >= parsed.limit) {
        nextPageCursor = id + 1n;
        break;
      }
    }

    // If the entire batch was empty (all zero-address), we've passed the last bounty.
    if (nonEmptyInBatch === 0) break;

    if (nextPageCursor) {
      nextId = nextPageCursor;
      break;
    }

    nextId += BigInt(batchSize);
  }

  const hasMore = nextId <= MAX_SCAN_ID && items.length === parsed.limit;

  return NextResponse.json(
    {
      items,
      nextCursor: hasMore ? nextId.toString() : null,
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
  if (status && !["open", "resolved", "cancelled", "expired"].includes(status)) {
    return { error: "status must be open, resolved, cancelled, or expired" };
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
  return MAINNET_V3;
}

function getRpcOverride(_chainId: number) {
  return process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;
}

function matchesStatus(bounty: ChainBounty, status?: StatusFilter): boolean {
  if (!status) return true;
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  switch (status) {
    case "open":
      return bounty.status === BountyStatus.Open && bounty.deadline > nowSeconds;
    case "resolved":
      return bounty.status === BountyStatus.Resolved;
    case "cancelled":
      return bounty.status === BountyStatus.Cancelled;
    case "expired":
      // No on-chain Expired state: an unresolved past-deadline bounty stays Open.
      return bounty.status === BountyStatus.Open && bounty.deadline <= nowSeconds;
  }
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

