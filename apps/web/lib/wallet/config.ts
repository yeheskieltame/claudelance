import type { EIP1193Provider } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { celoMainnet } from "../chain";

type MiniPayCandidate = {
  isMiniPay?: boolean;
  request?: EIP1193Provider["request"];
};

export const connectorResolutionOrder = ["minipay", "privy"] as const;

export type ConnectorResolution = (typeof connectorResolutionOrder)[number];

export function isMiniPay(provider: unknown = getInjectedProvider()): provider is MiniPayCandidate {
  return Boolean(provider && typeof provider === "object" && (provider as MiniPayCandidate).isMiniPay === true);
}

export function resolveConnector(provider: unknown = getInjectedProvider()): ConnectorResolution {
  return isMiniPay(provider) ? "minipay" : "privy";
}

const miniPayConnector = injected({
  shimDisconnect: true,
  target() {
    const provider = getInjectedProvider();
    if (!isMiniPay(provider)) return undefined;

    return {
      id: "minipay",
      name: "MiniPay",
      provider: provider as EIP1193Provider,
    };
  },
});

export const wagmiConfig = createConfig({
  chains: [celoMainnet],
  connectors: [miniPayConnector],
  ssr: true,
  transports: {
    [celoMainnet.id]: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
  },
});

/** Connector picker shared by every connect affordance. The single injected
 *  connector reports id "minipay" inside the webview and degrades to the
 *  default "injected" target (window.ethereum) everywhere else — wagmi falls
 *  back to the generic target when target() returns undefined. */
export function pickInjectedConnector<T extends { id: string }>(connectors: readonly T[]): T | undefined {
  return connectors.find((c) => c.id === "minipay" || c.id === "injected") ?? connectors[0];
}

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

function getInjectedProvider(): unknown {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: unknown }).ethereum;
}
