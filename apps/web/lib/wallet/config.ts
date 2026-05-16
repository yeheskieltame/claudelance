/**
 * apps/web/lib/wallet/config.ts
 *
 * Unified wagmi wallet connector configuration.
 *
 * Resolution order (first match wins):
 *   1. MiniPay   — injected provider (window.ethereum.isMiniPay === true)
 *   2. Privy     — @privy-io/wagmi connector (optional, degrades gracefully)
 *   3. Injected  — generic browser extension wallet (MetaMask, etc.)
 *
 * Chains: celoMainnet + celoSepolia
 *
 * Depends on: B38 (Privy SDK installation — add @privy-io/wagmi to
 * apps/web/package.json and set NEXT_PUBLIC_PRIVY_APP_ID in .env.local)
 */

import { createConfig, http } from "wagmi";
import { celoMainnet, celoSepolia } from "../chain";

/* ---------------------------------------------------------------------------
 * isMiniPay — detects MiniPay in-app browser
 * --------------------------------------------------------------------------- */

/**
 * Returns true when the current page is running inside the MiniPay in-app
 * browser on mobile. MiniPay auto-injects window.ethereum with
 * isMiniPay = true.
 *
 * Use this to adapt the UI — e.g. hide WalletConnect QR flows,
 * show a "copy address" tap-hint instead of a connection modal.
 */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  return window.ethereum?.isMiniPay === true;
}

/* ---------------------------------------------------------------------------
 * wagmiConfig
 * --------------------------------------------------------------------------- */

/**
 * Wagmi client config with connector priority:
 *   MiniPay (injected) > Privy > generic injected
 *
 * If @privy-io/wagmi is not yet installed or NEXT_PUBLIC_PRIVY_APP_ID is not
 * set, the config falls back to the injected connector (MiniPay / MetaMask).
 *
 * To add Privy support, run:
 *   pnpm add @privy-io/wagmi
 * and set NEXT_PUBLIC_PRIVY_APP_ID=<your-app-id> in apps/web/.env.local
 */
export const wagmiConfig = createConfig({
  chains: [celoMainnet, celoSepolia],
  connectors: buildConnectors(),
  transports: {
    [celoMainnet.id]: http(),
    [celoSepolia.id]: http(),
  },
});

/* ---------------------------------------------------------------------------
 * Connector builder
 * --------------------------------------------------------------------------- */

/** Builds the connector array at module initialisation time.
 *  If Privy is not installed / not configured, only the injected connector
 *  is returned — this keeps the module always import-safe.
 */
function buildConnectors() {
  return buildConnectorsWithPrivy() ?? buildConnectorsFallback();
}

function buildConnectorsWithPrivy():
  | Array<{ id: string; name: string; provider?: unknown }>
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrivyWagmiConnector } = require("@privy-io/wagmi/connector");
    return [
      injectedConnector(),
      new PrivyWagmiConnector({
        chains: [celoMainnet, celoSepolia],
      }),
    ];
  } catch {
    // @privy-io/wagmi not installed — fall through to fallback.
    return null;
  }
}

function buildConnectorsFallback() {
  return [injectedConnector()];
}

function injectedConnector() {
  return {
    id: "injected",
    name: "Browser Wallet",
    // wagmi's injected connector reads window.ethereum automatically.
    // The first injected provider that claims to be MiniPay wins due to the
    // order of connectors in the array — MiniPay must appear first.
    provider: typeof window !== "undefined" ? window.ethereum : undefined,
  };
}
