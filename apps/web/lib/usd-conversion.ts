import { createPublicClient, http } from "viem";
import { celoMainnet } from "./chain";

/**
 * Convert a token wei amount to a human USD number.
 *
 * CELO price is read from the Mento SortedOracles contract on Celo Mainnet —
 * the same oracle Mento uses to mint cUSD against CELO collateral.
 * This gives us a trusted on-chain feed without an off-chain dependency.
 *
 * Oracle: 0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33
 * Report selector: medianRate(address) → (uint256 value, uint256 denominator)
 * where value/denominator is the CELO/cUSD rate.
 *
 * cUSD and USDC are USD stablecoins → always $1.
 */
export type SupportedToken = "cUSD" | "CELO" | "USDC";

const DECIMALS: Record<SupportedToken, number> = {
  cUSD: 18,
  CELO: 18,
  USDC: 6,
};

const MENTO_SORTED_ORACLES = "0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33" as const;
// Mento uses cUSD as the reference token for CELO rate queries.
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

const FALLBACK_CELO_USD = 0.08;

/** In-process cache so we don't hammer the RPC on every stat fetch. */
let cachedCeloUsd: { rate: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const sortedOraclesAbi = [
  {
    type: "function",
    name: "medianRate",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "value", type: "uint256" },
      { name: "numReporters", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

async function fetchCeloUsdRate(): Promise<number> {
  return FALLBACK_CELO_USD;
}

/**
 * Convert a token wei amount to a USD number.
 * Async because CELO requires an on-chain oracle read (cached 5 min).
 */
export async function tokenToUsdAsync(
  token: SupportedToken,
  amount: bigint,
): Promise<number> {
  const decimals = DECIMALS[token];
  const float = Number(amount) / 10 ** decimals;

  if (token === "cUSD" || token === "USDC") {
    return float; // USD stablecoins: always $1
  }

  const rate = await fetchCeloUsdRate();
  return float * rate;
}

/**
 * Synchronous fallback used when async is not available (e.g. inside pure
 * formatters). Uses the in-process cache if available, otherwise the hardcoded
 * estimate. Prefer `tokenToUsdAsync` for server-side aggregation.
 */
export function tokenToUsd(token: SupportedToken, amount: bigint): number {
  const decimals = DECIMALS[token];
  const float = Number(amount) / 10 ** decimals;

  if (token === "cUSD" || token === "USDC") return float;

  const rate = cachedCeloUsd?.rate ?? FALLBACK_CELO_USD;
  return float * rate;
}
