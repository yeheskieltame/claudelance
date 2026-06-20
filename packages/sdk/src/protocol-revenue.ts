import type { Address, PublicClient } from "viem";

import { CLAUDELANCE_CORE_V3_ABI } from "@yeheskieltame/claudelance-types";

/**
 * Read total protocol revenue for a token from the Claudelance Core.
 *
 * Reads via `getStatsV3(token)` (UUPS proxy, EIP-7201 storage) which returns
 * the cumulative revenue as the second element.
 *
 * Revenue is denominated in the token's smallest unit (wei for cUSD/CELO,
 * 1e-6 for USDC). Each resolved bounty contributes 2% of its amount, plus
 * any forfeited stakes.
 */
export async function getProtocolRevenue(
  client: PublicClient,
  core: Address,
  token: Address,
): Promise<bigint> {
  // getStatsV3 returns (volume, revenue, resolved, posters, workers, countByType)
  const result = (await client.readContract({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    functionName: "getStatsV3",
    args: [token],
  })) as readonly [bigint, bigint, bigint, bigint, bigint, readonly bigint[]];
  return result[1]; // revenue is index 1
}
