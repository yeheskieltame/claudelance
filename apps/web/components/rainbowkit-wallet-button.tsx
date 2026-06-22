"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, useConnectModal } from "@rainbow-me/rainbowkit";

import { WalletButtonCore } from "@/components/wallet-button-core";

// Scoped to the connect button only - the rest of the app reads wallet state via
// wagmi's useAccount, so RainbowKitProvider does not need to wrap the whole tree.
// This whole module is dynamically imported (ssr:false) and skipped inside
// MiniPay, keeping the modal + WalletConnect bundle off the mobile critical path.
export default function RainbowKitWalletButton() {
  return (
    <RainbowKitProvider
      modalSize="compact"
      theme={darkTheme({
        accentColor: "#F9FF42",
        accentColorForeground: "#0a0a0a",
        borderRadius: "medium",
      })}
    >
      <RainbowKitWalletButtonInner />
    </RainbowKitProvider>
  );
}

function RainbowKitWalletButtonInner() {
  const { openConnectModal } = useConnectModal();
  return <WalletButtonCore onConnect={openConnectModal} />;
}
