"use client";

import * as React from "react";

export type EthereumProvider = {
  isMiniPay?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// Detects the Opera MiniPay in-app browser. Wallet connection stays with the
// caller so account prompts are not duplicated.
export function useMiniPayDetection() {
  const [isMiniPay, setIsMiniPay] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.ethereum?.isMiniPay) setIsMiniPay(true);
  }, []);

  return isMiniPay;
}
