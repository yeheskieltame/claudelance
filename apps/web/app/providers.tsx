"use client";

import * as React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { WagmiProvider } from "wagmi";

import { TransactionToast } from "@/components/transaction-toast";
import { isMiniPay, privyConfig, selectActiveWalletForWagmi, wagmiConfig } from "@/lib/wallet/config";

const queryClient = new QueryClient();
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const [miniPaySession, setMiniPaySession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setMiniPaySession(isMiniPay());
  }, []);

  const themedChildren = (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <TransactionToast />
    </ThemeProvider>
  );

  if (!privyAppId || miniPaySession !== false) {
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{themedChildren}</WagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig} setActiveWalletForWagmi={selectActiveWalletForWagmi}>
          {themedChildren}
        </PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
