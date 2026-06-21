import { MAINNET } from "@yeheskieltame/claudelance-types";
import type { Address } from "viem";

import { LANCE_ADDRESS } from "@/lib/lance";

export type TokenSymbol = "cUSD" | "CELO" | "USDC" | "USDT" | "LANCE";

// USD₮ on Celo (6 decimals). Not a Claudelance bounty token, so it lives here
// (wallet display + send), not in the contract's whitelisted-token config.
export const USDT_ADDRESS = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address;

/** Tailwind class snippets for per-token theming. Keys are the symbol strings. */
export const TOKEN_BADGE: Record<TokenSymbol, string> = {
  cUSD: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  CELO: "bg-amber-400/15 text-amber-800 ring-amber-400/30 dark:text-amber-200",
  USDC: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  USDT: "bg-teal-500/10 text-teal-700 ring-teal-500/25 dark:text-teal-300",
  LANCE: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
};

const ADDR_TO_SYMBOL: Record<string, TokenSymbol> = {
  [MAINNET.tokens.cUSD.toLowerCase()]: "cUSD",
  [MAINNET.tokens.CELO.toLowerCase()]: "CELO",
  [MAINNET.tokens.USDC.toLowerCase()]: "USDC",
  [USDT_ADDRESS.toLowerCase()]: "USDT",
  [LANCE_ADDRESS.toLowerCase()]: "LANCE",
};

export function symbolForAddress(address: Address | string | undefined): TokenSymbol | null {
  if (!address) return null;
  return ADDR_TO_SYMBOL[address.toLowerCase()] ?? null;
}
