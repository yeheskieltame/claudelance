import type { ConnectedWallet, PrivyProviderProps } from "@privy-io/react-auth";
import type { SetActiveWalletForWagmiType } from "@privy-io/wagmi";
import { createConfig, http, injected } from "wagmi";
import type { EIP1193Provider } from "viem";

import { celoMainnet, celoSepolia } from "@/lib/chain";

type MiniPayProvider = EIP1193Provider & {
  isMiniPay?: boolean;
  providers?: MiniPayProvider[];
};

const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

function lower(value: string | undefined) {
  return value?.toLowerCase() ?? "";
}

function getWindowEthereum() {
  if (typeof window === "undefined") return undefined;
  return window.ethereum as MiniPayProvider | undefined;
}

export function getMiniPayProvider(provider: MiniPayProvider | undefined = getWindowEthereum()) {
  if (provider?.isMiniPay) return provider;
  return provider?.providers?.find((nestedProvider) => nestedProvider.isMiniPay);
}

export function isMiniPay(provider?: MiniPayProvider) {
  return Boolean(getMiniPayProvider(provider));
}

function isMiniPayWallet(wallet: ConnectedWallet) {
  return [
    wallet.walletClientType,
    wallet.connectorType,
    wallet.meta.id,
    wallet.meta.name,
  ].some((value) => lower(value).includes("minipay"));
}

function isInjectedWallet(wallet: ConnectedWallet) {
  return lower(wallet.connectorType) === "injected";
}

function isPrivyWallet(wallet: ConnectedWallet) {
  return lower(wallet.walletClientType).startsWith("privy") || lower(wallet.connectorType) === "embedded";
}

export const selectActiveWalletForWagmi: SetActiveWalletForWagmiType = ({ wallets }) => {
  const ethereumWallets = wallets.filter((wallet) => wallet.type === "ethereum");

  if (isMiniPay()) {
    return (
      ethereumWallets.find(isMiniPayWallet) ??
      ethereumWallets.find(isInjectedWallet) ??
      ethereumWallets[0]
    );
  }

  return ethereumWallets.find(isPrivyWallet) ?? ethereumWallets[0];
};

export const miniPayConnector = injected({
  target: () => ({
    id: "minipay",
    name: "MiniPay",
    provider: (browserWindow) =>
      getMiniPayProvider(browserWindow?.ethereum as MiniPayProvider | undefined),
  }),
  unstable_shimAsyncInject: 250,
});

// Keep MiniPay as the first wagmi connector. When a Privy app id is present,
// @privy-io/wagmi mounts after this and syncs the selected Privy wallet.
export const wagmiConfig = createConfig({
  chains: [celoMainnet, celoSepolia],
  connectors: [miniPayConnector],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: {
    [celoMainnet.id]: http(process.env.NEXT_PUBLIC_CELO_MAINNET_RPC),
    [celoSepolia.id]: http(process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC),
  },
});

export const privyConfig = {
  appearance: {
    showWalletLoginFirst: true,
    walletChainType: "ethereum-only",
    walletList: ["detected_ethereum_wallets"],
  },
  defaultChain: celoMainnet,
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  loginMethods: ["wallet"],
  supportedChains: [celoMainnet, celoSepolia],
  walletConnectCloudProjectId: walletConnectProjectId,
} satisfies PrivyProviderProps["config"];

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
