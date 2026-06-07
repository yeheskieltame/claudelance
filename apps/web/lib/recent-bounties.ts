import "server-only";

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { MAINNET } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "@/lib/chain";
import { getDeployment } from "@/lib/contracts";

const bountyResolvedEvent = parseAbi([
  "event BountyResolved(uint256 indexed bountyId, address indexed winner, uint96 winnerPayout, uint96 protocolFee)",
]);

const getBountyAbi = [
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

const rpcOverride = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;

/** ~14 days at Celo's L2 1s blocktime. The feed only renders the latest
 *  `limit` wins (sorted by block), so the window just bounds how far back we
 *  look to find them — wide enough that the hero ticker isn't blanked by a
 *  multi-day quiet stretch. Truly empty history falls back to the terminal's
 *  "listening" state. */
const RECENT_WINDOW_BLOCKS = 1_200_000n;

function resolveTokenMeta(address: Address): { symbol: string; decimals: number } {
  const a = address.toLowerCase();
  if (a === MAINNET.tokens.USDC.toLowerCase()) return { symbol: "USDC", decimals: 6 };
  if (a === MAINNET.tokens.cUSD.toLowerCase()) return { symbol: "cUSD", decimals: 18 };
  if (a === MAINNET.tokens.CELO.toLowerCase()) return { symbol: "CELO", decimals: 18 };
  return { symbol: "cUSD", decimals: 18 };
}

export type ResolvedBountyLog = {
  bountyId: bigint;
  winner: Address;
  winnerPayout: bigint;
  protocolFee: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  tokenSymbol: string;
  tokenDecimals: number;
};

export async function fetchRecentResolved(limit = 5): Promise<ResolvedBountyLog[]> {
  const client = createPublicClient({ chain: celoMainnet, transport: http(rpcOverride) });
  const deploy = getDeployment(celoMainnet.id);

  const latest = await client.getBlockNumber();
  const fromBlock =
    latest > RECENT_WINDOW_BLOCKS ? latest - RECENT_WINDOW_BLOCKS : 0n;

  const logs = await client.getLogs({
    address: deploy.core as Address,
    events: bountyResolvedEvent,
    fromBlock,
    toBlock: latest,
  });

  const rows = logs
    .map((log) => ({
      bountyId: log.args.bountyId!,
      winner: log.args.winner!,
      winnerPayout: log.args.winnerPayout!,
      protocolFee: log.args.protocolFee!,
      txHash: log.transactionHash!,
      blockNumber: log.blockNumber!,
    }))
    .sort((a, b) => Number(b.blockNumber - a.blockNumber))
    .slice(0, limit);

  if (rows.length === 0) return [];

  const tokenResults = await client.multicall({
    allowFailure: true,
    contracts: rows.map((r) => ({
      address: deploy.core as Address,
      abi: getBountyAbi,
      functionName: "getBounty" as const,
      args: [r.bountyId] as const,
    })),
  });

  return rows.map((r, i) => {
    const result = tokenResults[i];
    let tokenSymbol = "cUSD";
    let tokenDecimals = 18;
    if (result?.status === "success" && result.result) {
      const meta = resolveTokenMeta((result.result as { token: Address }).token);
      tokenSymbol = meta.symbol;
      tokenDecimals = meta.decimals;
    }
    return { ...r, tokenSymbol, tokenDecimals };
  });
}
