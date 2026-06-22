"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { WalletButtonCore } from "@/components/wallet-button-core";
import { isMiniPay } from "@/lib/wallet/config";

// RainbowKit (modal + WalletConnect) is only needed for non-MiniPay sign-in.
// Code-split it so it never lands on the initial/LCP critical path, and skip it
// entirely inside MiniPay, which connects via the injected wagmi connector.
const RainbowKitWalletButton = dynamic(() => import("@/components/rainbowkit-wallet-button"), {
  ssr: false,
  loading: () => <WalletButtonCore />,
});

export function WalletButton() {
  const [external, setExternal] = React.useState(false);

  React.useEffect(() => {
    if (!isMiniPay(window.ethereum)) setExternal(true);
  }, []);

  return external ? <RainbowKitWalletButton /> : <WalletButtonCore />;
}
