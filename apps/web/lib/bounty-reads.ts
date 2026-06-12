import "server-only";

import { createPublicClient, http, type Address } from "viem";
import { BountyStatus, MAINNET_V3, type Deployment } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "@/lib/chain";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const BATCH_SIZE = 25;
// v3 does not expose bountyCount() as a public getter (EIP-7201 storage).
// We scan in batches and stop when a full batch returns only zero-address posters.
const MAX_SCAN_ID = 100_000n;

export const bountyReadAbi = [
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

export type StatusFilter = "open" | "resolved" | "cancelled" | "expired";
export type TokenFilter = "cusd" | "celo" | "usdc";

export type ChainBounty = {
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

export type ChainSubmission = {
  deliverableHash: `0x${string}`;
  submittedAt: bigint;
  ciPassed: boolean;
  stakeSettled: boolean;
  deliverableUrl: string;
  metadata: string;
};

export type BountyJson = ReturnType<typeof toJsonBounty>;
export type SubmissionJson = ReturnType<typeof toJsonSubmission>;
export type BountyDetailJson = BountyJson & {
  claimers: Address[];
  submissions: SubmissionJson[];
};

export function getActiveDeployment(): Deployment {
  return MAINNET_V3;
}

function corePublicClient() {
  return createPublicClient({
    chain: celoMainnet,
    transport: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
  });
}

export function toJsonBounty(id: bigint, bounty: ChainBounty) {
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

export function toJsonSubmission(worker: Address, submission: ChainSubmission) {
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

export function normalizeBounty(result: unknown): ChainBounty {
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

export function normalizeSubmission(result: unknown): ChainSubmission {
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

export function matchesStatus(bounty: ChainBounty, status?: StatusFilter): boolean {
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

export function matchesToken(
  bounty: ChainBounty,
  token: TokenFilter | undefined,
  deployment: Deployment,
): boolean {
  if (!token) return true;

  const tokenAddress =
    token === "cusd"
      ? deployment.tokens.cUSD
      : token === "celo"
        ? deployment.tokens.CELO
        : deployment.tokens.USDC;

  return bounty.token.toLowerCase() === tokenAddress.toLowerCase();
}

export async function readBountyPage(options: {
  status?: StatusFilter;
  token?: TokenFilter;
  limit: number;
  cursor?: bigint;
}): Promise<{ items: BountyJson[]; nextCursor: string | null }> {
  const deployment = getActiveDeployment();
  const client = corePublicClient();

  const items: BountyJson[] = [];
  let nextId = options.cursor ?? 1n;

  while (nextId <= MAX_SCAN_ID && items.length < options.limit) {
    const ids = Array.from({ length: BATCH_SIZE }, (_, index) => nextId + BigInt(index));

    const results = await client.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({
        address: deployment.core,
        abi: bountyReadAbi,
        functionName: "getBounty" as const,
        args: [id] as const,
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

      if (!matchesStatus(bounty, options.status)) continue;
      if (!matchesToken(bounty, options.token, deployment)) continue;

      items.push(toJsonBounty(id, bounty));
      if (items.length >= options.limit) {
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

    nextId += BigInt(BATCH_SIZE);
  }

  const hasMore = nextId <= MAX_SCAN_ID && items.length === options.limit;

  return { items, nextCursor: hasMore ? nextId.toString() : null };
}

export async function readBountyDetail(bountyId: bigint): Promise<BountyDetailJson | null> {
  const deployment = getActiveDeployment();
  const client = corePublicClient();

  const [bountyResult, claimersResult] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: deployment.core,
        abi: bountyReadAbi,
        functionName: "getBounty",
        args: [bountyId],
      },
      {
        address: deployment.core,
        abi: bountyReadAbi,
        functionName: "getClaimers",
        args: [bountyId],
      },
    ],
  });

  const bounty = normalizeBounty(bountyResult);
  if (bounty.poster === ZERO_ADDRESS) return null;

  const claimers = claimersResult as Address[];
  const submissionResults =
    claimers.length === 0
      ? []
      : await client.multicall({
          allowFailure: true,
          contracts: claimers.map((worker) => ({
            address: deployment.core,
            abi: bountyReadAbi,
            functionName: "getSubmission" as const,
            args: [bountyId, worker] as const,
          })),
        });

  const submissions = submissionResults.flatMap((result, index) => {
    if (result.status !== "success") return [];

    const worker = claimers[index];
    if (!worker) return [];

    return [toJsonSubmission(worker, normalizeSubmission(result.result))];
  });

  return { ...toJsonBounty(bountyId, bounty), claimers, submissions };
}
