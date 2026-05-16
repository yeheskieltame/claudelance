import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { EIP1193Provider } from "viem";

import { celoMainnet, celoSepolia } from "@/lib/chain";

type MiniPayProvider = EIP1193Provider & {
  isMiniPay?: boolean;
};

type WalletWindow = Window & {
  ethereum?: MiniPayProvider;
};

function injectedProvider(win?: unknown) {
  const walletWindow =
    win ?? (typeof window === "undefined" ? undefined : window);

  return (walletWindow as WalletWindow | undefined)?.ethereum;
}

export function isMiniPay(provider: EIP1193Provider | undefined = injectedProvider()) {
  return Boolean((provider as MiniPayProvider | undefined)?.isMiniPay);
}

const miniPayConnector = injected({
  shimDisconnect: true,
  target: {
    id: "minipay",
    name: "MiniPay",
    provider: (win) => {
      const provider = injectedProvider(win);
      return isMiniPay(provider) ? provider : undefined;
    },
  },
});

const privyConnector = injected({
  shimDisconnect: true,
  target: {
    id: "privy",
    name: "Privy",
    provider: (win) => {
      const provider = injectedProvider(win);
      return provider && !isMiniPay(provider) ? provider : undefined;
    },
  },
});

// Resolution order is intentional: MiniPay wins inside the MiniPay browser,
// and Privy handles the non-MiniPay web flow.
export const wagmiConfig = createConfig({
  ssr: true,
  chains: [celoMainnet, celoSepolia],
  connectors: [miniPayConnector, privyConnector],
  transports: {
    [celoMainnet.id]: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
    [celoSepolia.id]: http(process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
