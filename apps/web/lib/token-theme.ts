import { MAINNET } from "@yeheskieltame/claudelance-types";
import type { Address } from "viem";

export type TokenSymbol = "cUSD" | "CELO" | "USDC";

/** Tailwind class snippets for per-token theming. Keys are the symbol strings. */
export const TOKEN_BADGE: Record<TokenSymbol, string> = {
  cUSD: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  CELO: "bg-amber-400/15 text-amber-800 ring-amber-400/30 dark:text-amber-200",
  USDC: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
};

const ADDR_TO_SYMBOL: Record<string, TokenSymbol> = {
  [MAINNET.tokens.cUSD.toLowerCase()]: "cUSD",
  [MAINNET.tokens.CELO.toLowerCase()]: "CELO",
  [MAINNET.tokens.USDC.toLowerCase()]: "USDC",
};

export function symbolForAddress(address: Address | string | undefined): TokenSymbol | null {
  if (!address) return null;
  return ADDR_TO_SYMBOL[address.toLowerCase()] ?? null;
}
