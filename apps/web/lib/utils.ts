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
  return format18Decimals(wei, fractionDigits);
}

export function formatCELO(wei: bigint, fractionDigits = 2): string {
  return format18Decimals(wei, fractionDigits);
}

function format18Decimals(wei: bigint, fractionDigits: number): string {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, fractionDigits);
  return fractionDigits > 0 ? `${whole.toString()}.${fractionStr}` : whole.toString();
}
