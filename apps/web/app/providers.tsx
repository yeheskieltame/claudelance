"use client";

import * as React from "react";
import { WagmiProvider } from "@privy-io/wagmi";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { wagmiConfig } from "@/lib/wallet/config";
import { celoMainnet, celoSepolia } from "@/lib/chain";
import { TransactionToast } from "@/components/transaction-toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep cached for 1 min; revalidate in background.
      staleTime: 60_000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clqy3h0xx00xxxxxxxxxxxxxx";

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#676FFF",
          logo: "/logo.png",
        },
        supportedChains: [celoMainnet, celoSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <TransactionToast />
          </ThemeProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
