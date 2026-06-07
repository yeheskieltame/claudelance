import "server-only";

import { createPublicClient, http, type Address } from "viem";
import { CLAUDELANCE_CORE_V3_ABI, MAINNET_V3 } from "@yeheskieltame/claudelance-types";

import { celoMainnet, DEFAULT_CHAIN_ID } from "@/lib/chain";
import { getDeployment } from "@/lib/contracts";

export type TokenEarnings = {
  symbol: "cUSD" | "CELO" | "USDC";
  token: Address;
  amount: bigint;
};

export type WorkerStats = {
  earnings: TokenEarnings[];
};

// v3 mainnet proxy deploy block (2026-06-04). Lower bound for the log scan.
const V3_DEPLOY_BLOCK = 68_536_240n;

const TOKENS = [
  { symbol: "cUSD" as const, token: MAINNET_V3.tokens.cUSD as Address },
  { symbol: "CELO" as const, token: MAINNET_V3.tokens.CELO as Address },
  { symbol: "USDC" as const, token: MAINNET_V3.tokens.USDC as Address },
];

/**
 * Pending (claimable) earnings per token. v3 exposes no `earnings` getter
 * (EIP-7201 storage), so reconstruct the mapping from events: it is credited
 * only by winner payouts and refunded stakes, and debited by withdrawals.
 *   earnings[worker][token]
 *     = sum(BountyResolved.winnerPayout where winner = worker, by token)
 *     + sum(StakeSettled.amount where worker = worker and not forfeited, by bounty token)
 *     - sum(EarningsWithdrawn.amount where worker = worker, by token)
 * The on-chain withdraw is the source of truth; this is the display estimate.
 */
export async function fetchWorkerStats(worker: Address): Promise<WorkerStats> {
  const deployment = getDeployment(DEFAULT_CHAIN_ID);
  const core = deployment.core as Address;
  const client = createPublicClient({
    chain: celoMainnet,
    transport: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
  });

  const balances = new Map<string, bigint>(TOKENS.map((t) => [t.token.toLowerCase(), 0n]));
  const credit = (tokenAddr: string | undefined, delta: bigint) => {
    if (!tokenAddr) return;
    const key = tokenAddr.toLowerCase();
    if (balances.has(key)) balances.set(key, balances.get(key)! + delta);
  };

  try {
    const [resolved, withdrawn, settled] = await Promise.all([
      client.getContractEvents({
        address: core, abi: CLAUDELANCE_CORE_V3_ABI, eventName: "BountyResolved",
        args: { winner: worker }, fromBlock: V3_DEPLOY_BLOCK,
      }),
      client.getContractEvents({
        address: core, abi: CLAUDELANCE_CORE_V3_ABI, eventName: "EarningsWithdrawn",
        args: { worker }, fromBlock: V3_DEPLOY_BLOCK,
      }),
      client.getContractEvents({
        address: core, abi: CLAUDELANCE_CORE_V3_ABI, eventName: "StakeSettled",
        args: { worker }, fromBlock: V3_DEPLOY_BLOCK,
      }),
    ]);

    for (const log of resolved) {
      const a = log.args as { token?: Address; winnerPayout?: bigint };
      credit(a.token, a.winnerPayout ?? 0n);
    }
    for (const log of withdrawn) {
      const a = log.args as { token?: Address; amount?: bigint };
      credit(a.token, -(a.amount ?? 0n));
    }

    // StakeSettled has no token field; resolve each refunded bounty's token.
    const refunds = settled
      .filter((l) => (l.args as { forfeited?: boolean }).forfeited === false)
      .map((l) => l.args as { bountyId?: bigint; amount?: bigint });
    if (refunds.length > 0) {
      const bounties = await client.multicall({
        allowFailure: true,
        contracts: refunds.map((r) => ({
          address: core, abi: CLAUDELANCE_CORE_V3_ABI, functionName: "getBounty" as const,
          args: [r.bountyId ?? 0n] as const,
        })),
      });
      bounties.forEach((res, i) => {
        if (res.status !== "success") return;
        credit((res.result as { token?: Address }).token, refunds[i]!.amount ?? 0n);
      });
    }
  } catch {
    // Log scan failed; fall back to zeros so the page still renders.
  }

  const earnings: TokenEarnings[] = TOKENS.map((t) => {
    const v = balances.get(t.token.toLowerCase()) ?? 0n;
    return { ...t, amount: v > 0n ? v : 0n };
  });

  return { earnings };
}
