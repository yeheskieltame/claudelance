"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TransactionToast } from "@/components/transaction-toast";
import { wagmiConfig } from "@/lib/wallet/config";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <TransactionToast />
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}