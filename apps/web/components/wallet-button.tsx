"use client";

import { WalletButtonCore } from "@/components/wallet-button-core";
import { useWalletAuth } from "@/lib/wallet/auth";

export function WalletButton() {
  const { authenticated, enabled, githubUsername, login, logout, ready, wallet } = useWalletAuth();

  return (
    <WalletButtonCore
      onPrivyConnect={enabled ? () => login() : undefined}
      onPrivyDisconnect={enabled ? logout : undefined}
      privyAuthenticated={authenticated}
      privyAddress={wallet?.address}
      privyReady={ready}
      privyGithub={githubUsername}
    />
  );
}
