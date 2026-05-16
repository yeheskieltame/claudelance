"use client";

import * as React from "react";
import { getMiniPayProvider } from "@/lib/wallet/config";

/// Detects the Opera MiniPay in-app browser. When present, MiniPay auto-injects
/// `window.ethereum.isMiniPay = true` and expects the dapp to call
/// `eth_requestAccounts` eagerly so the user lands inside an authorised session.
export function useMiniPayDetection() {
  const [detectedMiniPay, setDetectedMiniPay] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const miniPayProvider = getMiniPayProvider();
    if (miniPayProvider) {
      setDetectedMiniPay(true);
      miniPayProvider.request({ method: "eth_requestAccounts" }).catch(() => {
        // User dismissed connection — leave isMiniPay true so the UI can still
        // adapt (hide WalletConnect, surface a "tap your address" hint).
      });
    }
  }, []);

  return detectedMiniPay;
}
