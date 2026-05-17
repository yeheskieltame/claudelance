import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string | undefined): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatCUSD(wei: bigint, fractionDigits = 2): string {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, fractionDigits);
  return fractionDigits > 0 ? `${whole.toString()}.${fractionStr}` : whole.toString();
}

export function formatTokenDisplay(wei: bigint, decimals: number, symbol: string): string {
  if (wei === 0n) return `0`;
  const whole = wei / 10n ** BigInt(decimals);
  const fraction = wei % 10n ** BigInt(decimals);
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2).replace(/0+$/, "");
  return fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString();
}
