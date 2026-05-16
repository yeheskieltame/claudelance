"use client";

import dynamic from "next/dynamic";

import { WalletButtonCore } from "@/components/wallet-button-core";

const HAS_PRIVY_APP_ID = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

const PrivyWalletButton = dynamic(
  () => import("@/components/wallet-button-privy").then((mod) => mod.PrivyWalletButton),
  {
    loading: () => <WalletButtonCore privy={{ enabled: true, ready: false, authenticated: false }} />,
    ssr: false,
  },
);

export function WalletButton() {
  if (HAS_PRIVY_APP_ID) {
    return <PrivyWalletButton />;
  }

  return <WalletButtonCore />;
}
