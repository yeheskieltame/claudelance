"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "wagmi";

import { TransactionToast } from "@/components/transaction-toast";
import { celoMainnet, celoSepolia, DEFAULT_CHAIN_ID } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  const content = process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        defaultChain: DEFAULT_CHAIN_ID === celoMainnet.id ? celoMainnet : celoSepolia,
        supportedChains: [celoSepolia, celoMainnet],
      }}
    >
      {children}
    </PrivyProvider>
  ) : (
    children
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {content}
          <TransactionToast />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
