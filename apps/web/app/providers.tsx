"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

import { TransactionToast } from "@/components/transaction-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <TransactionToast />
    </ThemeProvider>
  );
}
