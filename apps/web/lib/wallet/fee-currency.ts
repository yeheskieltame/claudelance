import type { Address } from "viem";
import { MAINNET } from "@yeheskieltame/claudelance-types";

import { isMiniPay } from "@/lib/wallet/config";
import { USDT_ADDRESS } from "@/lib/token-theme";

// MiniPay wallets hold no native CELO for gas. Celo fee abstraction (CIP-64)
// lets a tx pay gas in a stablecoin instead; viem's `celo` chain serializes this
// field. We pay gas in the token being sent when it is a fee-currency stablecoin
// (so a USDT-only wallet can send USDT, a USDC-only wallet can send USDC, etc.),
// and fall back to cUSD otherwise. Outside MiniPay we return undefined so the
// wallet pays gas in native CELO.
const FEE_CURRENCIES = new Set<string>([
  (MAINNET.tokens.cUSD as Address).toLowerCase(),
  (MAINNET.tokens.USDC as Address).toLowerCase(),
  USDT_ADDRESS.toLowerCase(),
]);

export function miniPayFeeCurrency(preferred?: Address): Address | undefined {
  if (!isMiniPay()) return undefined;
  if (preferred && FEE_CURRENCIES.has(preferred.toLowerCase())) return preferred;
  return MAINNET.tokens.cUSD as Address;
}
