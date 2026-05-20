"use client";

import * as React from "react";
import {
  getEmbeddedConnectedWallet,
  type ConnectedWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";

import { getGithubUsername } from "@/lib/github-link";

type MaybePromise = Promise<void> | void;

type WalletAuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  enabled: boolean;
  login: () => MaybePromise;
  logout: () => MaybePromise;
  wallet?: ConnectedWallet;
  wallets: ConnectedWallet[];
  githubUsername: string | null;
  connectWalletToWagmi: (wallet?: ConnectedWallet) => Promise<void>;
};

const fallbackAuth: WalletAuthContextValue = {
  ready: true,
  authenticated: false,
  enabled: false,
  login: () => undefined,
  logout: () => undefined,
  wallets: [],
  githubUsername: null,
  connectWalletToWagmi: async () => undefined,
};

const WalletAuthContext = React.createContext<WalletAuthContextValue | null>(null);

export function WalletAuthFallbackProvider({ children }: { children: React.ReactNode }) {
  return <WalletAuthContext.Provider value={fallbackAuth}>{children}</WalletAuthContext.Provider>;
}

export function WalletAuthProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, login, logout, ready, user } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const wallet = getEmbeddedConnectedWallet(wallets) ?? wallets[0];

  const connectWalletToWagmi = React.useCallback(
    async (targetWallet = wallet) => {
      if (!targetWallet) return;
      await setActiveWallet(targetWallet);
    },
    [setActiveWallet, wallet],
  );

  React.useEffect(() => {
    if (!ready || !walletsReady || !authenticated || !wallet) return;
    void connectWalletToWagmi(wallet);
  }, [authenticated, connectWalletToWagmi, ready, wallet, walletsReady]);

  const value = React.useMemo<WalletAuthContextValue>(
    () => ({
      ready: ready && walletsReady,
      authenticated,
      enabled: true,
      login,
      logout,
      wallet,
      wallets,
      githubUsername: getGithubUsername(user),
      connectWalletToWagmi,
    }),
    [authenticated, connectWalletToWagmi, login, logout, ready, user, wallet, wallets, walletsReady],
  );

  return <WalletAuthContext.Provider value={value}>{children}</WalletAuthContext.Provider>;
}

export function useWalletAuth() {
  const context = React.useContext(WalletAuthContext);
  if (!context) {
    throw new Error("useWalletAuth must be used inside WalletAuthProvider");
  }
  return context;
}
