import "server-only";

import { createPublicClient, http, parseAbi, type Address } from "viem";

import { celoMainnet } from "@/lib/chain";
import { getDeployment } from "@/lib/contracts";

const bountyResolvedEvent = parseAbi([
  "event BountyResolved(uint256 indexed bountyId, address indexed winner, uint96 winnerPayout, uint96 protocolFee)",
]);

const rpcOverride = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;

/** ~6 days at Celo's 5s blocktime — leaderboard window short enough
 *  to reflect recent activity, long enough to avoid an empty list. */
const LEADERBOARD_WINDOW_BLOCKS = 100_000n;

export type ActiveWorker = {
  address: Address;
  wins: number;
  totalPayout: bigint;
  lastBlock: bigint;
};

export async function fetchActiveWorkers(): Promise<ActiveWorker[]> {
  const client = createPublicClient({ chain: celoMainnet, transport: http(rpcOverride) });
  const deploy = getDeployment(celoMainnet.id);

  const latest = await client.getBlockNumber();
  const fromBlock =
    latest > LEADERBOARD_WINDOW_BLOCKS ? latest - LEADERBOARD_WINDOW_BLOCKS : 0n;

  const logs = await client.getLogs({
    address: deploy.core as Address,
    events: bountyResolvedEvent,
    fromBlock,
    toBlock: latest,
  });

  const map = new Map<Address, ActiveWorker>();
  for (const log of logs) {
    const winner = log.args.winner!;
    const payout = log.args.winnerPayout!;
    const block = log.blockNumber!;
    const row = map.get(winner);
    if (row) {
      row.wins += 1;
      row.totalPayout += payout;
      if (block > row.lastBlock) row.lastBlock = block;
    } else {
      map.set(winner, { address: winner, wins: 1, totalPayout: payout, lastBlock: block });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return Number(b.lastBlock - a.lastBlock);
  });
}
