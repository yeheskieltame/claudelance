import type { Address } from "viem";
import { MAINNET_V3 } from "@yeheskieltame/claudelance-types";

import { type TokenSymbol, USDT_ADDRESS } from "@/lib/token-theme";

export type TokenMeta = {
  symbol: TokenSymbol;
  address: Address;
  decimals: number;
  /** Short human label for the asset row. */
  name: string;
};

/**
 * The wallet-facing token set for the connected user (asset list + send form).
 * Decimals: USDC and USDT are 6, cUSD/CELO are 18. CELO is an ERC-20 on Celo, so
 * a plain ERC-20 `transfer` moves all of them uniformly. USDT is wallet-only (not
 * a Claudelance bounty token); it is here so funds can move in/out of MiniPay.
 */
export const WALLET_TOKENS: readonly TokenMeta[] = [
  { symbol: "cUSD", address: MAINNET_V3.tokens.cUSD as Address, decimals: 18, name: "Celo Dollar" },
  { symbol: "CELO", address: MAINNET_V3.tokens.CELO as Address, decimals: 18, name: "Celo" },
  { symbol: "USDC", address: MAINNET_V3.tokens.USDC as Address, decimals: 6, name: "USD Coin" },
  { symbol: "USDT", address: USDT_ADDRESS, decimals: 6, name: "Tether USD" },
] as const;

export function tokenBySymbol(symbol: TokenSymbol): TokenMeta {
  const found = WALLET_TOKENS.find((t) => t.symbol === symbol);
  if (!found) throw new Error(`Unknown token symbol ${symbol}`);
  return found;
}
