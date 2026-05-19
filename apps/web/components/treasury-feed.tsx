import { createPublicClient, http, parseAbi, type Address } from "viem";

import { MAINNET } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "@/lib/chain";
import { txUrl } from "@/lib/celoscan";

const revenueEvent = parseAbi([
  "event ProtocolRevenueAccrued(address indexed token, uint256 amount, uint256 cumulative)",
]);

const rpcOverride = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;

type RevenueLog = {
  token: Address;
  amount: bigint;
  cumulative: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
};

export async function TreasuryFeed() {
  const client = createPublicClient({
    chain: celoMainnet,
    transport: http(rpcOverride),
  });

  // ~50k blocks ≈ last 3 days on Celo (5s blocktime).
  const latest = await client.getBlockNumber();
  const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;

  const logs = await client.getLogs({
    address: MAINNET.core,
    events: revenueEvent,
    fromBlock,
    toBlock: latest,
  });

  const rows: RevenueLog[] = logs
    .map((log) => ({
      token: log.args.token!,
      amount: log.args.amount!,
      cumulative: log.args.cumulative!,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }))
    .reverse()
    .slice(0, 10);

  if (rows.length === 0) {
    return (
      <div className="glass mt-10 rounded-3xl p-8">
        <h2 className="font-display text-2xl">Recent accruals</h2>
        <p className="mt-2 text-muted-foreground">
          No revenue events in the last 50k blocks. Post a bounty to start the
          feed.
        </p>
      </div>
    );
  }

  return (
    <div className="glass mt-10 rounded-3xl p-8">
      <h2 className="font-display text-2xl">Recent accruals</h2>
      <ul className="mt-4 divide-y divide-white/10">
        {rows.map((r) => (
          <li key={r.txHash} className="flex items-center justify-between py-3 text-sm">
            <span className="font-mono">{symbolFor(r.token)}</span>
            <span>{(Number(r.amount) / 1e18).toFixed(4)}</span>
            <a
              href={txUrl(r.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              {r.txHash.slice(0, 10)}…
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function symbolFor(token: Address): string {
  const t = token.toLowerCase();
  if (t === MAINNET.tokens.cUSD.toLowerCase()) return "cUSD";
  if (t === MAINNET.tokens.CELO.toLowerCase()) return "CELO";
  if (t === MAINNET.tokens.USDC.toLowerCase()) return "USDC";
  return "?";
}
