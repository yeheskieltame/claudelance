const CELO_USD_FALLBACK = 0.4;

type CoingeckoResponse = {
  celo?: { usd?: number };
};

export async function getCeloUsdPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd", {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return CELO_USD_FALLBACK;
    const data: CoingeckoResponse = await res.json();
    const usd = data.celo?.usd;
    if (typeof usd === "number" && usd > 0) return usd;
    return CELO_USD_FALLBACK;
  } catch {
    return CELO_USD_FALLBACK;
  }
}

/// Converts a token volume into CELO wei (18 decimals).
/// - tokenAmount: raw on-chain wei.
/// - tokenDecimals: 18 for cUSD/CELO, 6 for USDC.
/// - usdPerToken: stablecoin assumption (1 for cUSD/USDC, market for CELO).
/// - celoUsdPrice: CELO/USD reference rate.
export function tokenToCeloWei(
  tokenAmount: bigint,
  tokenDecimals: number,
  usdPerToken: number,
  celoUsdPrice: number,
): bigint {
  if (tokenAmount === 0n) return 0n;
  if (celoUsdPrice <= 0) return 0n;
  // Work in fixed-point: scale celo/usd ratio to 1e6 to avoid float drift.
  const ratioE6 = BigInt(Math.round((usdPerToken / celoUsdPrice) * 1_000_000));
  const decimalShift = 10n ** BigInt(18 - tokenDecimals);
  return (tokenAmount * decimalShift * ratioE6) / 1_000_000n;
}
