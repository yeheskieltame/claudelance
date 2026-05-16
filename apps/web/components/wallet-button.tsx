"use client";

import * as React from "react";
import { LogOut, Wallet } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { chainById } from "@/lib/chain";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 650;

export function WalletButton() {
  if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return <WalletButtonWithPrivy />;
  }

  return <WalletButtonContent />;
}

function WalletButtonWithPrivy() {
  const { authenticated, login, logout, ready, user } = usePrivy();
  const privyAddress = user?.wallet?.address;

  return (
    <WalletButtonContent
      fallbackAddress={authenticated ? privyAddress : undefined}
      fallbackDisabled={!ready}
      onFallbackConnect={login}
      onFallbackDisconnect={logout}
    />
  );
}

function WalletButtonContent({
  fallbackAddress,
  fallbackDisabled,
  onFallbackConnect,
  onFallbackDisconnect,
}: {
  fallbackAddress?: string;
  fallbackDisabled?: boolean;
  onFallbackConnect?: () => void;
  onFallbackDisconnect?: () => void;
}) {
  const account = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [miniPayAddress, setMiniPayAddress] = React.useState<string>();
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const address = account.address ?? miniPayAddress ?? fallbackAddress;
  const connected = Boolean(address);
  const chain = chainById(account.chainId ?? chainId);
  const isMiniPay =
    typeof window !== "undefined" ? Boolean(window.ethereum?.isMiniPay) : false;

  const clearLongPress = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDisconnect = React.useCallback(() => {
    clearLongPress();
    setMiniPayAddress(undefined);
    if (account.isConnected) disconnect();
    if (fallbackAddress) onFallbackDisconnect?.();
  }, [account.isConnected, clearLongPress, disconnect, fallbackAddress, onFallbackDisconnect]);

  const startLongPress = React.useCallback(() => {
    if (!connected) return;
    clearLongPress();
    longPressTimer.current = setTimeout(handleDisconnect, LONG_PRESS_MS);
  }, [clearLongPress, connected, handleDisconnect]);

  React.useEffect(() => clearLongPress, [clearLongPress]);

  async function handleConnect() {
    if (connected) return;

    if (isMiniPay && window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (Array.isArray(accounts) && typeof accounts[0] === "string") {
        setMiniPayAddress(accounts[0]);
        return;
      }
    }

    const injected = connectors.find((connector) => connector.id === "injected");
    if (injected) {
      connect({ connector: injected });
      return;
    }

    onFallbackConnect?.();
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={connected ? "secondary" : "primary"}
      disabled={isPending || fallbackDisabled}
      aria-label={connected ? "Wallet connected. Long press or right click to disconnect." : "Connect wallet"}
      title={connected ? "Long press or right click to disconnect" : "Connect wallet"}
      onClick={handleConnect}
      onContextMenu={(event) => {
        if (!connected) return;
        event.preventDefault();
        handleDisconnect();
      }}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      className={cn("min-w-0 px-3 sm:px-4", connected && "max-w-[13rem]")}
    >
      {connected ? (
        <>
          <span className="hidden rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
            {isMiniPay ? "MiniPay" : chain?.name ?? "Wallet"}
          </span>
          <span className="truncate font-mono text-xs">{truncateAddress(address!)}</span>
          <LogOut className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </>
      ) : (
        <>
          <Wallet className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{isPending ? "Connecting" : "Connect"}</span>
        </>
      )}
    </Button>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
