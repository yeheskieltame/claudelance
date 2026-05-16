"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

import { TransactionToast } from "@/components/transaction-toast";
import { InstallPrompt } from "@/components/install-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <InstallPrompt />
      <TransactionToast />
    </ThemeProvider>
  );
}
