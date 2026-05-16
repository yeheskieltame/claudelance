"use client";

import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";

import { WalletButtonCore } from "@/components/wallet-button-core";
import { DEFAULT_CHAIN_ID, chainById, celoSepolia, supportedChains } from "@/lib/chain";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const defaultChain = chainById(DEFAULT_CHAIN_ID) ?? celoSepolia;

function parsePrivyChainId(chainId?: string | number | null) {
  if (typeof chainId === "number") return chainId;
  if (!chainId) return undefined;
  const raw = chainId.startsWith("eip155:") ? chainId.slice("eip155:".length) : chainId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PrivyWalletButton() {
  if (!privyAppId) {
    return <WalletButtonCore />;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          accentColor: "#f4c24c",
          theme: "dark",
          walletChainType: "ethereum-only",
        },
        defaultChain,
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
        },
        loginMethods: ["wallet"],
        supportedChains: [...supportedChains],
      }}
    >
      <PrivyWalletButtonInner />
    </PrivyProvider>
  );
}

function PrivyWalletButtonInner() {
  const { authenticated, login, logout, ready } = usePrivy();
  const { wallets } = useWallets();
  const primaryWallet = wallets[0];

  return (
    <WalletButtonCore
      privy={{
        enabled: true,
        authenticated,
        ready,
        address: primaryWallet?.address,
        chainId: parsePrivyChainId(primaryWallet?.chainId),
        login,
        logout,
      }}
    />
  );
}
