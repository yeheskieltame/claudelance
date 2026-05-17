import { createPublicClient, http, type Address } from "viem";
import { CLAUDELANCE_CORE_ABI, type Bounty } from "@yeheskieltame/claudelance-types";
import { celoSepolia, celoMainnet, DEFAULT_CHAIN_ID, chainById } from "./chain";
import { getDeployment } from "./contracts";

const rpcOverrides: Partial<Record<number, string>> = {
  [celoSepolia.id]: process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC,
  [celoMainnet.id]: process.env.NEXT_PUBLIC_CELO_MAINNET_RPC,
};

export async function fetchLatestOpenBounties(limit = 5, chainId = DEFAULT_CHAIN_ID): Promise<Array<Bounty & { id: string }>> {
  const chain = chainById(chainId);
  if (!chain) throw new Error(`Unsupported chain id ${chainId}`);
  const rpc = rpcOverrides[chainId] ?? chain.rpcUrls.default.http[0];
  const client = createPublicClient({ chain, transport: http(rpc) });
  const deploy = getDeployment(chainId);

  const totalCount = await client.readContract({
    address: deploy.core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: "bountyCount",
  }).catch(() => 0n);

  if (totalCount === 0n) return [];

  const bounties: Array<Bounty & { id: string }> = [];
  let cursor = totalCount;
  const BATCH_SIZE = 10;

  while (cursor >= 1n && bounties.length < limit) {
    const batchSize = Number(cursor < BigInt(BATCH_SIZE) ? cursor : BigInt(BATCH_SIZE));
    const ids = Array.from({ length: batchSize }, (_, i) => cursor - BigInt(i));

    const results = (await client.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({
        address: deploy.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: "getBounty",
        args: [id],
      })) as any,
    })) as any[];

    for (const [index, result] of results.entries()) {
      if (result.status !== "success") continue;
      const id = ids[index];
      if (id === undefined) continue;
      const bounty = normalizeBounty(result.result);
      // BountyStatus.Open is 0
      if (Number(bounty.status) === 0) {
        bounties.push({
          ...bounty,
          id: id.toString(),
        });
        if (bounties.length >= limit) break;
      }
    }

    cursor -= BigInt(batchSize);
  }

  return bounties;
}

function normalizeBounty(result: unknown): Bounty {
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
  return result as Bounty;
}
