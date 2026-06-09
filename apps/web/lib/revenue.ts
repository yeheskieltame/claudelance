import { createPublicClient, http, type Address } from "viem";

import {
  CLAUDELANCE_CORE_ABI,
  CLAUDELANCE_CORE_V3_ABI,
  MAINNET_V2,
  MAINNET_V3,
} from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "./chain";

const rpcOverride = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;

export type TokenAmounts = {
  cUSD: bigint;
  CELO: bigint;
  USDC: bigint;
};

export type TreasuryRevenue = TokenAmounts & {
  /** Per-contract split: v2 immutable core vs v3 UUPS proxy. */
  v2: TokenAmounts;
  v3: TokenAmounts;
};

/**
 * Server-side multicall reading protocol revenue per token from BOTH live
 * contracts. Fees accrue on each independently: the v2 immutable core holds
 * the code-bounty era, the v3 proxy holds the task-type era. v2 exposes the
 * `totalProtocolRevenue(token)` public getter; v3 (EIP-7201 storage) exposes
 * revenue as index 1 of `getStatsV3(token)`.
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
      makeV2RevenueRead(MAINNET_V2.tokens.cUSD),
      makeV2RevenueRead(MAINNET_V2.tokens.CELO),
      makeV2RevenueRead(MAINNET_V2.tokens.USDC),
    ],
    allowFailure: true,
  });

  const v3Revenue = (i: number): bigint => {
    const r = results[i];
    if (!r || r.status === "failure") return 0n;
    return (r.result as readonly bigint[])[1] ?? 0n;
  };
  const v2Revenue = (i: number): bigint => {
    const r = results[i];
    if (!r || r.status === "failure") return 0n;
    return r.result as bigint;
  };

  const v3 = { cUSD: v3Revenue(0), CELO: v3Revenue(1), USDC: v3Revenue(2) };
  const v2 = { cUSD: v2Revenue(3), CELO: v2Revenue(4), USDC: v2Revenue(5) };

  return {
    cUSD: v2.cUSD + v3.cUSD,
    CELO: v2.CELO + v3.CELO,
    USDC: v2.USDC + v3.USDC,
    v2,
    v3,
  };
}

function makeV3StatsRead(token: Address) {
  return {
    address: MAINNET_V3.core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    functionName: "getStatsV3" as const,
    args: [token] as const,
  };
}

function makeV2RevenueRead(token: Address) {
  return {
    address: MAINNET_V2.core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: "totalProtocolRevenue" as const,
    args: [token] as const,
  };
}
