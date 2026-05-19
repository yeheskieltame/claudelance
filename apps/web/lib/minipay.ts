"use client";

import * as React from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import type { Address } from "viem";

import { isMiniPay as isMiniPayProvider } from "@/lib/wallet/config";

/// Detects the Opera MiniPay in-app browser. When present, MiniPay auto-injects
/// `window.ethereum.isMiniPay = true` and expects the dapp to call
/// `eth_requestAccounts` eagerly so the user lands inside an authorised session.
export function useMiniPayDetection() {
  const [isMiniPay, setIsMiniPay] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const provider = window.ethereum;
    if (isMiniPayProvider(provider)) {
      setIsMiniPay(true);
      provider.request?.({ method: "eth_requestAccounts" })?.catch(() => {
        // User dismissed connection — leave isMiniPay true so the UI can still
        // adapt (hide WalletConnect, surface a "tap your address" hint).
      });
    }
  }, []);

  return isMiniPay;
}

/// Reads the connected wallet's balance for the given ERC20 token.
/// Returns balance = null while disconnected so the caller can render a fallback.
export function useMiniPayBalance(token: Address | undefined): {
  balance: bigint | null;
  decimals: number;
  isLoading: boolean;
} {
  const { address } = useAccount();
  const chainId = useChainId();

  const balanceQuery = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(address && token) },
  });

  const decimalsQuery = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: Boolean(token) },
  });

  return {
    balance: typeof balanceQuery.data === "bigint" ? balanceQuery.data : null,
    decimals: typeof decimalsQuery.data === "number" ? decimalsQuery.data : 18,
    isLoading: balanceQuery.isLoading || decimalsQuery.isLoading,
  };
}
