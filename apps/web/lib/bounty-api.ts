import { createPublicClient, http, type Address } from "viem";

import {
  BountyStatus,
  CLAUDELANCE_CORE_ABI,
  type Bounty,
  type Submission,
} from "@yeheskieltame/claudelance-types";

import { chainById, DEFAULT_CHAIN_ID } from "./chain";
import { getDeployment } from "./contracts";

export const BOUNTY_API_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
} as const;

export class BountyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BountyListFilters = {
  chainId?: number;
  cursor?: bigint;
  limit?: number;
  status?: BountyStatus;
  token?: Address;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const TOKEN_QUERY_TO_SYMBOL = {
  cusd: "cUSD",
  celo: "CELO",
  usdc: "USDC",
} as const;
const STATUS_QUERY_TO_CODE = {
  open: BountyStatus.Open,
  resolved: BountyStatus.Resolved,
} as const;
const STATUS_LABELS = ["open", "resolved", "cancelled", "expired"] as const;

function bountyClient(chainId: number = DEFAULT_CHAIN_ID) {
  const chain = chainById(chainId);
  if (!chain) throw new BountyApiError(400, `Unsupported chainId: ${chainId}`);

  const deployment = getDeployment(chainId);
  const rpcUrl =
    chainId === 42_220
      ? process.env.NEXT_PUBLIC_CELO_MAINNET_RPC
      : process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC;

  return {
    chainId,
    client: createPublicClient({
      chain,
      transport: http(rpcUrl ?? chain.rpcUrls.default.http[0]),
    }),
    deployment,
  };
}

export function parseChainId(searchParams: URLSearchParams) {
  const raw = searchParams.get("chainId");
  if (!raw) return DEFAULT_CHAIN_ID;
  if (!/^\d+$/.test(raw)) throw new BountyApiError(400, "chainId must be a positive integer");
  return Number(raw);
}

export function parseBountyId(raw: string) {
  if (!/^\d+$/.test(raw)) throw new BountyApiError(400, "Bounty id must be a positive integer");
  const id = BigInt(raw);
  if (id < 1n) throw new BountyApiError(400, "Bounty id must be greater than zero");
  return id;
}

export function parseListFilters(searchParams: URLSearchParams): BountyListFilters {
  return {
    chainId: parseChainId(searchParams),
    cursor: parseOptionalBigInt(searchParams.get("cursor"), "cursor"),
    limit: parseLimit(searchParams.get("limit")),
    status: parseStatus(searchParams.get("status")),
    token: parseToken(searchParams),
  };
}

export async function fetchBountyList(filters: BountyListFilters = {}) {
  const { chainId, client, deployment } = bountyClient(filters.chainId);
  const count = (await client.readContract({
    address: deployment.core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: "bountyCount",
  })) as bigint;
  const ids = idsBetween(1n, count);
  const bounties =
    ids.length === 0
      ? []
      : ((await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            address: deployment.core,
            abi: CLAUDELANCE_CORE_ABI,
            functionName: "getBounty" as const,
            args: [id] as const,
          })),
        })) as Bounty[]);

  const indexed = bounties.map((bounty, index) => ({
    bounty,
    id: BigInt(index + 1),
  }));

  const filtered = indexed.filter(({ bounty }) => {
    if (filters.status !== undefined && bounty.status !== filters.status) return false;
    if (filters.token && bounty.token.toLowerCase() !== filters.token.toLowerCase()) return false;
    return true;
  });

  const cursor = filters.cursor ?? 0n;
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const page = filtered.filter(({ id }) => id > cursor).slice(0, limit);
  const last = page.at(-1);
  const nextCursor = last && filtered.some(({ id }) => id > last.id) ? last.id.toString() : null;

  return {
    chainId,
    items: page.map(({ bounty, id }) => serializeBounty(id, bounty, deployment.tokens)),
    nextCursor,
    total: filtered.length,
  };
}

export async function fetchBountyDetails(id: bigint, chainId: number = DEFAULT_CHAIN_ID) {
  const { client, deployment } = bountyClient(chainId);
  const count = (await client.readContract({
    address: deployment.core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: "bountyCount",
  })) as bigint;
  if (id > count) return null;

  const [bounty, claimers] = (await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: deployment.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "getBounty" as const,
        args: [id] as const,
      },
      {
        address: deployment.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "getClaimers" as const,
        args: [id] as const,
      },
    ],
  })) as [Bounty, Address[]];

  const submissionReads =
    claimers.length === 0
      ? []
      : ((await client.multicall({
          allowFailure: false,
          contracts: claimers.map((worker) => ({
            address: deployment.core,
            abi: CLAUDELANCE_CORE_ABI,
            functionName: "getSubmission" as const,
            args: [id, worker] as const,
          })),
        })) as Submission[]);

  return {
    ...serializeBounty(id, bounty, deployment.tokens),
    chainId,
    submissions: submissionReads.map((submission, index) =>
      serializeSubmission(claimers[index]!, submission),
    ),
  };
}

function parseOptionalBigInt(raw: string | null, name: string) {
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) throw new BountyApiError(400, `${name} must be a non-negative integer`);
  return BigInt(raw);
}

function parseLimit(raw: string | null) {
  if (!raw) return DEFAULT_LIMIT;
  if (!/^\d+$/.test(raw)) throw new BountyApiError(400, "limit must be a positive integer");
  const limit = Number(raw);
  if (limit < 1) throw new BountyApiError(400, "limit must be at least 1");
  return Math.min(limit, MAX_LIMIT);
}

function parseStatus(raw: string | null) {
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (!(normalized in STATUS_QUERY_TO_CODE)) {
    throw new BountyApiError(400, "status must be one of: open, resolved");
  }
  return STATUS_QUERY_TO_CODE[normalized as keyof typeof STATUS_QUERY_TO_CODE];
}

function parseToken(searchParams: URLSearchParams) {
  const raw = searchParams.get("token");
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (!(normalized in TOKEN_QUERY_TO_SYMBOL)) {
    throw new BountyApiError(400, "token must be one of: cusd, celo, usdc");
  }

  const chainId = parseChainId(searchParams);
  const deployment = getDeployment(chainId);
  return deployment.tokens[TOKEN_QUERY_TO_SYMBOL[normalized as keyof typeof TOKEN_QUERY_TO_SYMBOL]];
}

function idsBetween(start: bigint, endInclusive: bigint) {
  const ids: bigint[] = [];
  for (let id = start; id <= endInclusive; id += 1n) ids.push(id);
  return ids;
}

function serializeBounty(
  id: bigint,
  bounty: Bounty,
  tokens: Record<"cUSD" | "CELO" | "USDC", Address>,
) {
  return {
    id: id.toString(),
    poster: bounty.poster,
    amount: bounty.amount.toString(),
    winner: bounty.winner,
    stakeRequired: bounty.stakeRequired.toString(),
    token: bounty.token,
    tokenSymbol: tokenSymbolForAddress(bounty.token, tokens),
    deadline: bounty.deadline.toString(),
    maxSlots: Number(bounty.maxSlots),
    claimedSlots: Number(bounty.claimedSlots),
    bountyType: Number(bounty.bountyType),
    ciRequired: bounty.ciRequired,
    targetWorker: bounty.targetWorker,
    status: STATUS_LABELS[Number(bounty.status)] ?? "unknown",
    statusCode: Number(bounty.status),
    targetRepoUrl: bounty.targetRepoUrl,
    instructionUrl: bounty.instructionUrl,
    requirementsHash: bounty.requirementsHash,
  };
}

function serializeSubmission(worker: Address, submission: Submission) {
  return {
    worker,
    commitHash: submission.commitHash,
    submittedAt: submission.submittedAt.toString(),
    ciPassed: submission.ciPassed,
    stakeRefunded: submission.stakeRefunded,
    prUrl: submission.prUrl,
    metadata: submission.metadata,
    submitted: submission.submittedAt > 0n || submission.prUrl.length > 0,
  };
}

function tokenSymbolForAddress(token: Address, tokens: Record<"cUSD" | "CELO" | "USDC", Address>) {
  const match = Object.entries(tokens).find(([, address]) => address.toLowerCase() === token.toLowerCase());
  return match?.[0] ?? "unknown";
}
