import { createConfig } from "@privy-io/wagmi";
import { injected } from "wagmi/connectors";
import { http } from "wagmi";
import { celoMainnet, celoSepolia } from "../chain";

/**
 * Helper to check if the current environment is Opera MiniPay.
 * MiniPay injects a web3 provider under window.ethereum with the `isMiniPay` flag set to true.
 */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.ethereum && window.ethereum.isMiniPay);
}

/**
 * Wagmi configuration for Claudelance, utilizing @privy-io/wagmi for combined wallet support.
 * 
 * Resolution Order:
 * 1. Injected (MiniPay / MetaMask / EIP-1193) connector is checked first.
 * 2. Privy's embedded wallet connector is resolved thereafter.
 */
export const wagmiConfig = createConfig({
  chains: [celoMainnet, celoSepolia],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [celoMainnet.id]: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC ?? "https://forno.celo.org"),
    [celoSepolia.id]: http(
      process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC ?? "https://forno.celo-sepolia.celo-testnet.org/",
    ),
  },
  ssr: true,
});
