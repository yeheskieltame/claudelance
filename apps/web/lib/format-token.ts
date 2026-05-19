/**
 * Format an ERC20-style wei bigint into a short human string.
 * - Trims trailing zeros after the decimal point.
 * - Slices the fractional part to `maxFractionDigits` so balances stay compact.
 *
 * Useful for inline displays where formatUnits() + Number().toLocaleString()
 * would either lose precision (via Number) or leak long fractional tails.
 */
export function formatTokenAmount(
  raw: bigint,
  decimals: number,
  maxFractionDigits = 3,
): string {
  if (raw === 0n) return "0";
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  const out = fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${out}` : out;
}

/** Convenience wrapper for 18-decimal native tokens (CELO, cUSD on Celo). */
export function formatCELO(wei: bigint): string {
  return formatTokenAmount(wei, 18);
}

/** USDC on Celo uses 6 decimals — convenience wrapper to avoid passing it inline. */
export function formatUSDC(units: bigint): string {
  return formatTokenAmount(units, 6);
}
