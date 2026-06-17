import "server-only";

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { MAINNET } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "@/lib/chain";
import { agentIdFor } from "@/lib/agent-ids";

const IDENTITY_REGISTRY = MAINNET.identityRegistry as Address;
const REPUTATION_REGISTRY = MAINNET.reputationRegistry as Address;
const identityAbi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
const reputationAbi = parseAbi([
  "function getClients(uint256 agentId) view returns (address[])",
  "function getSummary(uint256 agentId, address[] clients, string tag1, string tag2) view returns (uint64 count, int128 score, uint8 avg)",
]);

export type WorkerIdentity = {
  hasIdentity: boolean;
  registry: Address;
  /** ERC-8004 agent id (Identity NFT token id), if known for this address. */
  agentId?: bigint;
  /** On-chain ERC-8004 feedback count (reputation). */
  feedbackCount: number;
};

/**
 * Whether `worker` holds an ERC-8004 Identity NFT - the same `balanceOf > 0`
 * gate the Core enforces on `claimSlot` (NoAgentIdentity) - plus its agent id
 * and on-chain reputation (feedback count) when known.
 */
export async function fetchWorkerIdentity(worker: Address): Promise<WorkerIdentity> {
  const client = createPublicClient({
    chain: celoMainnet,
    transport: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
  });
  const agentId = agentIdFor(worker);

  let hasIdentity = false;
  try {
    const balance = (await client.readContract({
      address: IDENTITY_REGISTRY,
      abi: identityAbi,
      functionName: "balanceOf",
      args: [worker],
    })) as bigint;
    hasIdentity = balance > 0n;
  } catch {
    // RPC trip - fall through with defaults
  }

  let feedbackCount = 0;
  if (agentId !== undefined) {
    try {
      const clients = (await client.readContract({
        address: REPUTATION_REGISTRY,
        abi: reputationAbi,
        functionName: "getClients",
        args: [agentId],
      })) as readonly Address[];
      if (clients.length > 0) {
        const [count] = (await client.readContract({
          address: REPUTATION_REGISTRY,
          abi: reputationAbi,
          functionName: "getSummary",
          args: [agentId, clients, "", ""],
        })) as readonly [bigint, bigint, number];
        feedbackCount = Number(count);
      }
    } catch {
      // reputation read failed - leave at 0
    }
  }

  return { hasIdentity, registry: IDENTITY_REGISTRY, agentId, feedbackCount };
}
