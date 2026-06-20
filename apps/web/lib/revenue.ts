import { createPublicClient, http, type Address } from "viem";

import { CLAUDELANCE_CORE_V3_ABI, MAINNET_V3 } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "./chain";

const rpcOverride = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;

export type TokenAmounts = {
  cUSD: bigint;
  CELO: bigint;
  USDC: bigint;
};

export type TreasuryRevenue = TokenAmounts;

/**
 * Server-side multicall reading protocol revenue per token from the v3 proxy on
 * Celo mainnet. v3 (EIP-7201 storage) exposes revenue as index 1 of
 * `getStatsV3(token)`.
 */
export async function fetchTreasuryRevenue(): Promise<TreasuryRevenue> {
  const client = createPublicClient({
    chain: celoMainnet,
    transport: http(rpcOverride),
  });

  const results = await client.multicall({
    contracts: [
      makeV3StatsRead(MAINNET_V3.tokens.cUSD),
      makeV3StatsRead(MAINNET_V3.tokens.CELO),
      makeV3StatsRead(MAINNET_V3.tokens.USDC),
    ],
    allowFailure: true,
  });

  const revenue = (i: number): bigint => {
    const r = results[i];
    if (!r || r.status === "failure") return 0n;
    return (r.result as readonly bigint[])[1] ?? 0n;
  };

  return { cUSD: revenue(0), CELO: revenue(1), USDC: revenue(2) };
}

function makeV3StatsRead(token: Address) {
  return {
    address: MAINNET_V3.core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    functionName: "getStatsV3" as const,
    args: [token] as const,
  };
}
