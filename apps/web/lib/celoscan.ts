/** Canonical Celoscan base URL for Celo Mainnet (chain 42220). */
const CELOSCAN_BASE = "https://celoscan.io";

export function txUrl(hash: string): string {
  return `${CELOSCAN_BASE}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${CELOSCAN_BASE}/address/${address}`;
}

export function contractCodeUrl(address: string): string {
  return `${CELOSCAN_BASE}/address/${address}#code`;
}
