/**
 * Shared token logo and metadata for cUSD, CELO, and USDC.
 *
 * Logos are sourced from Trust Wallet Assets CDN — a reliable, maintained
 * repository of on-chain token logos keyed by contract address.
 */

export type TokenSymbol = "cUSD" | "CELO" | "USDC";

type TokenMeta = {
  symbol: TokenSymbol;
  logoUrl: string;
  color: string;           // tailwind ring/text color hint
  bgColor: string;         // tailwind bg for badge
  textColor: string;       // tailwind text for badge
};

const TW_BASE = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/assets";

export const TOKEN_META: Record<TokenSymbol, TokenMeta> = {
  cUSD: {
    symbol: "cUSD",
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/200x200/7236.png",
    color: "text-slate-600 dark:text-slate-300",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-700 dark:text-slate-200",
  },
  CELO: {
    symbol: "CELO",
    // Native CELO ERC20
    logoUrl: `${TW_BASE}/0x471EcE3750Da237f93B8E339c536989b8978a438/logo.png`,
    color: "text-amber-600 dark:text-amber-300",
    bgColor: "bg-amber-400/15",
    textColor: "text-amber-700 dark:text-amber-200",
  },
  USDC: {
    symbol: "USDC",
    // USDC on Celo (Circle native)
    logoUrl: `${TW_BASE}/0xcebA9300f2b948710d2653dD7B07f33A8B32118C/logo.png`,
    color: "text-blue-600 dark:text-blue-300",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-700 dark:text-blue-200",
  },
};

export function getTokenMeta(symbol: string): TokenMeta {
  return TOKEN_META[symbol as TokenSymbol] ?? TOKEN_META["cUSD"];
}
