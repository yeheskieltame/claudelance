"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { getEmbeddedConnectedWallet, PrivyProvider } from "@privy-io/react-auth";
import { type SetActiveWalletForWagmiType, WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { WagmiProvider as BaseWagmiProvider } from "wagmi";

import { TransactionToast } from "@/components/transaction-toast";
import { WalletAuthFallbackProvider, WalletAuthProvider } from "@/lib/wallet/auth";
import { isMiniPay, wagmiConfig } from "@/lib/wallet/config";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const selectPrivyWalletForWagmi: SetActiveWalletForWagmiType = ({ wallets }) =>
  getEmbeddedConnectedWallet(wallets) ?? wallets[0];

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  const [miniPayActive, setMiniPayActive] = React.useState(false);
  const privyWalletEnabled = Boolean(privyAppId && !miniPayActive);

  React.useEffect(() => {
    setMiniPayActive(isMiniPay());
  }, []);

  const content = (
    <>
      {children}
      <TransactionToast />
    </>
  );

  const walletContent = privyWalletEnabled ? (
    <WalletAuthProvider>{content}</WalletAuthProvider>
  ) : (
    <WalletAuthFallbackProvider>{content}</WalletAuthFallbackProvider>
  );

  const app = (
    <QueryClientProvider client={queryClient}>
      {privyWalletEnabled ? (
        <PrivyWagmiProvider config={wagmiConfig} setActiveWalletForWagmi={selectPrivyWalletForWagmi}>
          {walletContent}
        </PrivyWagmiProvider>
      ) : (
        <BaseWagmiProvider config={wagmiConfig}>{walletContent}</BaseWagmiProvider>
      )}
    </QueryClientProvider>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {privyAppId ? (
        <PrivyProvider
          appId={privyAppId}
          config={{
            loginMethods: ["github", "wallet", "email"],
            appearance: { theme: "dark", accentColor: "#7C5CFC" },
            embeddedWallets: { createOnLogin: "users-without-wallets" },
          }}
        >
          {app}
        </PrivyProvider>
      ) : (
        app
      )}
    </ThemeProvider>
  );
}
