import "server-only";

import { createPublicClient, http } from "viem";
import type { Address } from "viem";
import { MAINNET_V3 } from "@yeheskieltame/claudelance-types";

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

export async function fetchWorkerStats(worker: Address): Promise<WorkerStats> {
  const deployment = getDeployment(DEFAULT_CHAIN_ID);
  const client = createPublicClient({
    chain: celoMainnet,
    transport: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
  });

  const tokens = [
    { symbol: "cUSD" as const, token: MAINNET_V3.tokens.cUSD as Address },
    { symbol: "CELO" as const, token: MAINNET_V3.tokens.CELO as Address },
    { symbol: "USDC" as const, token: MAINNET_V3.tokens.USDC as Address },
  ];

  // v3: earnings() mapping is not a public getter (EIP-7201 storage).
  // The catch returns 0n for v3; the worker UI shows 0 pending earnings
  // (withdraw first to see balance, then check wallet directly).
  const earningsAbi = [
    { type: "function", name: "earnings", inputs: [{ name: "addr", type: "address" }, { name: "token", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  ] as const;

  const earnings = await Promise.all(
    tokens.map(async (entry) => {
      try {
        const amount = (await client.readContract({
          address: deployment.core as Address,
          abi: earningsAbi,
          functionName: "earnings",
          args: [worker, entry.token],
        })) as bigint;
        return { ...entry, amount };
      } catch {
        return { ...entry, amount: 0n };
      }
    }),
  );

  return { earnings };
}
