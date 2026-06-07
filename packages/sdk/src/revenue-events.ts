import { parseAbi, type Address, type PublicClient } from "viem";

const REVENUE_EVENT = parseAbi([
  "event ProtocolRevenueAccrued(address indexed token, uint256 amount, uint256 cumulative)",
]);

export type ProtocolRevenueAccrual = {
  token: Address;
  amount: bigint;
  cumulative: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
};

/**
 * Page the last `lookback` blocks of `ProtocolRevenueAccrued` events from the
 * Claudelance Core. Default 50k blocks is about 14 hours at Celo's ~1s L2
 * blocktime; pass a larger lookback for a wider window. Returns newest-first.
 */
export async function listProtocolRevenueEvents(
  client: PublicClient,
  core: Address,
  lookback: bigint = 50_000n,
): Promise<ProtocolRevenueAccrual[]> {
  const latest = await client.getBlockNumber();
  const fromBlock = latest > lookback ? latest - lookback : 0n;

  const logs = await client.getLogs({
    address: core,
    events: REVENUE_EVENT,
    fromBlock,
    toBlock: latest,
  });

  return logs
    .map((log) => ({
      token: log.args.token!,
      amount: log.args.amount!,
      cumulative: log.args.cumulative!,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }))
    .reverse();
}
