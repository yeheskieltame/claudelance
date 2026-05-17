import { createPublicClient, http, type Address } from "viem";

import { MAINNET, CLAUDELANCE_CORE_ABI } from "@yeheskieltame/claudelance-types";

import { celoMainnet } from "./chain";

const rpcOverride = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC;

export type TreasuryRevenue = {
  cUSD: bigint;
  CELO: bigint;
  USDC: bigint;
};

/**
 * Server-side multicall reading `totalProtocolRevenue(token)` for each of the
 * three whitelisted tokens on the Celo Mainnet Core contract. One round-trip
 * to Forno, three results. Gracefully falls back to 0 if the RPC times out.
 */
export async function fetchTreasuryRevenue(): Promise<TreasuryRevenue> {
  try {
    const client = createPublicClient({
      chain: celoMainnet,
      transport: http(rpcOverride),
    });

    const [cusd, celo, usdc] = await client.multicall({
      contracts: [
        makeRevenueRead(MAINNET.tokens.cUSD),
        makeRevenueRead(MAINNET.tokens.CELO),
        makeRevenueRead(MAINNET.tokens.USDC),
      ],
      allowFailure: true,
    });

    return {
      cUSD: (cusd.status === "success" ? cusd.result : 0n) as bigint,
      CELO: (celo.status === "success" ? celo.result : 0n) as bigint,
      USDC: (usdc.status === "success" ? usdc.result : 0n) as bigint,
    };
  } catch {
    return { cUSD: 0n, CELO: 0n, USDC: 0n };
  }
}

function makeRevenueRead(token: Address) {
  return {
    address: MAINNET.core,
    abi: CLAUDELANCE_CORE_ABI,
    functionName: "totalProtocolRevenue" as const,
    args: [token] as const,
  };
}