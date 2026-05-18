"use client";

import * as React from "react";
import { Check, ChevronDown, Github, Loader2, LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { DEFAULT_CHAIN_ID, chainById } from "@/lib/chain";
import { isMiniPay } from "@/lib/wallet/config";
import { cn, shortAddress } from "@/lib/utils";

type MiniPayEthereum = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletButtonCoreProps = {
  onPrivyConnect?: () => Promise<void> | void;
  onPrivyDisconnect?: () => Promise<void> | void;
  privyReady?: boolean;
  privyAuthenticated?: boolean;
  privyAddress?: string;
  privyGithub?: string | null;
};

export function WalletButtonCore({
  onPrivyConnect,
  onPrivyDisconnect,
  privyReady = true,
  privyAuthenticated = false,
  privyAddress,
  privyGithub,
}: WalletButtonCoreProps) {
  const { address, chain, connector, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [miniPayActive, setMiniPayActive] = React.useState(false);
  const miniPayConnectStarted = React.useRef(false);
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setMiniPayActive(isMiniPay(window.ethereum));
  }, []);

  const chainName = chain?.name ?? chainById(DEFAULT_CHAIN_ID)?.name ?? "Celo";
  const connectorName = miniPayActive ? "MiniPay" : connector?.name ?? (privyAuthenticated ? "Privy" : "Wallet");
  const connected = isConnected || Boolean(privyAuthenticated && privyAddress);
  const displayAddress = address ?? privyAddress;
  const label = displayAddress ? shortAddress(displayAddress) : connected ? "Connected" : "Connect";
  const disabled = isPending || !privyReady;

  React.useEffect(() => {
    if (!miniPayActive || connected || miniPayConnectStarted.current) return;

    const miniPayConnector = connectors.find((item) => item.id === "minipay");
    if (!miniPayConnector) return;

    miniPayConnectStarted.current = true;
    connectAsync({ connector: miniPayConnector, chainId: DEFAULT_CHAIN_ID }).catch(() => {
      miniPayConnectStarted.current = false;
    });
  }, [connectAsync, connected, connectors, miniPayActive]);

  const cancelLongPress = React.useCallback(() => {
    if (!longPressRef.current) return;
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
  }, []);

  React.useEffect(() => cancelLongPress, [cancelLongPress]);

  async function connectWallet() {
    if (connected || disabled) return;

    if (miniPayActive) {
      const miniPayConnector = connectors.find((item) => item.id === "minipay");
      if (miniPayConnector) {
        await connectAsync({ connector: miniPayConnector, chainId: DEFAULT_CHAIN_ID });
        return;
      }
      const provider = window.ethereum as MiniPayEthereum | undefined;
      await provider?.request?.({ method: "eth_requestAccounts" });
      return;
    }

    if (onPrivyConnect) {
      await onPrivyConnect();
      return;
    }

    const injectedConnector = connectors.find((item) => item.id === "privy") ?? connectors[0];
    if (injectedConnector) {
      await connectAsync({ connector: injectedConnector, chainId: DEFAULT_CHAIN_ID });
    }
  }

  async function disconnectWallet() {
    if (!connected) return;
    cancelLongPress();
    await disconnectAsync().catch(() => undefined);
    if (onPrivyDisconnect) {
      await Promise.resolve(onPrivyDisconnect()).catch(() => undefined);
    }
  }

  function startLongPress(event: React.PointerEvent<HTMLButtonElement>) {
    if (!connected || event.pointerType === "mouse") return;
    cancelLongPress();
    longPressRef.current = setTimeout(() => {
      longPressRef.current = null;
      void disconnectWallet();
    }, 650);
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={connected ? "outline" : "primary"}
      disabled={disabled}
      onClick={() => void connectWallet()}
      onContextMenu={(event) => {
        if (!connected) return;
        event.preventDefault();
        void disconnectWallet();
      }}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      title={connected ? "Right-click or long-press to disconnect" : "Connect wallet or sign in with GitHub"}
      className={cn(
        "h-9 min-w-0 px-3 sm:min-w-36 sm:px-4",
        connected && "border-border/70 bg-background/75 pr-2 backdrop-blur hover:bg-accent/70",
      )}
    >
      {isPending ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : connected ? (
        <Check aria-hidden="true" className="h-4 w-4 text-success" />
      ) : (
        <Wallet aria-hidden="true" className="h-4 w-4" />
      )}
      <span className="hidden max-w-28 truncate sm:inline">{label}</span>
      <span className="sr-only">{connected ? `${label} connected on ${chainName}` : "Connect wallet"}</span>
      {connected ? (
        <>
          {privyGithub ? (
            <span className="hidden items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground md:inline-flex">
              <Github aria-hidden="true" className="h-3 w-3" />
              {privyGithub}
            </span>
          ) : (
            <span className="hidden rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground md:inline">
              {connectorName}
            </span>
          )}
          <span className="hidden rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success sm:inline">
            {chainName}
          </span>
        </>
      ) : (
        <ChevronDown aria-hidden="true" className="hidden h-3.5 w-3.5 sm:block" />
      )}
      {connected ? <LogOut aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground sm:hidden" /> : null}
    </Button>
  );
}
