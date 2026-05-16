"use client";

import * as React from "react";
import { ChevronDown, Smartphone, Unplug, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type EthereumProvider, useMiniPayDetection } from "@/lib/minipay";
import { cn } from "@/lib/utils";

const CHAIN_LABELS: Record<number, string> = {
  42_220: "Celo",
  11_142_220: "Celo Sepolia",
};

export type PrivyControls = {
  enabled: boolean;
  authenticated: boolean;
  ready: boolean;
  address?: string;
  chainId?: number;
  login?: () => void;
  logout?: () => Promise<void> | void;
};

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseChainId(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const radix = value.startsWith("0x") ? 16 : 10;
  const parsed = Number.parseInt(value, radix);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readAccounts(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value : [];
}

function findInjectedProvider(preferMiniPay: boolean): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  const provider = window.ethereum;
  if (!provider) return undefined;
  if (!preferMiniPay) return provider;
  return provider.isMiniPay ? provider : provider.providers?.find((candidate) => candidate.isMiniPay) ?? provider;
}

export function WalletButtonCore({ privy }: { privy?: PrivyControls }) {
  const isMiniPay = useMiniPayDetection();
  const [injectedAddress, setInjectedAddress] = React.useState<string>();
  const [injectedChainId, setInjectedChainId] = React.useState<number>();
  const [isConnecting, setIsConnecting] = React.useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const consumedLongPress = React.useRef(false);

  const provider = React.useMemo(() => findInjectedProvider(isMiniPay), [isMiniPay]);
  const privyEnabled = Boolean(privy?.enabled);
  const connectedAddress = injectedAddress ?? privy?.address;
  const connected = Boolean(connectedAddress || (privy?.authenticated && privy.address));
  const activeChainId = injectedChainId ?? privy?.chainId;
  const badge = isMiniPay
    ? "MiniPay"
    : activeChainId
      ? CHAIN_LABELS[activeChainId] ?? `Chain ${activeChainId}`
      : privy?.authenticated
        ? "Privy"
        : "Wallet";

  const refreshInjectedState = React.useCallback(async () => {
    if (!provider) return;

    const [accounts, chainId] = await Promise.all([
      provider.request({ method: "eth_accounts" }).catch(() => []),
      provider.request({ method: "eth_chainId" }).catch(() => undefined),
    ]);
    const [address] = readAccounts(accounts);
    setInjectedAddress(address);
    setInjectedChainId(parseChainId(chainId));
  }, [provider]);

  const connectInjected = React.useCallback(async () => {
    if (!provider) return false;

    setIsConnecting(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const [address] = readAccounts(accounts);
      const chainId = await provider.request({ method: "eth_chainId" }).catch(() => undefined);
      setInjectedAddress(address);
      setInjectedChainId(parseChainId(chainId));
      return Boolean(address);
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  const clearLongPress = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDisconnect = React.useCallback(async () => {
    clearLongPress();
    setInjectedAddress(undefined);
    setInjectedChainId(undefined);
    if (provider) {
      await provider
        .request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        })
        .catch(() => undefined);
    }
    if (privy?.authenticated) {
      await privy.logout?.();
    }
  }, [clearLongPress, privy, provider]);

  React.useEffect(() => {
    void refreshInjectedState();
  }, [refreshInjectedState]);

  React.useEffect(() => {
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const [address] = readAccounts(accounts);
      setInjectedAddress(address);
    };
    const handleChainChanged = (chainId: unknown) => {
      setInjectedChainId(parseChainId(chainId));
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider]);

  React.useEffect(() => {
    if (!isMiniPay || injectedAddress || isConnecting) return;
    void connectInjected().catch(() => undefined);
  }, [connectInjected, injectedAddress, isConnecting, isMiniPay]);

  React.useEffect(() => clearLongPress, [clearLongPress]);

  async function handleClick() {
    if (consumedLongPress.current) {
      consumedLongPress.current = false;
      return;
    }

    if (connected) return;

    if (isMiniPay || !privyEnabled) {
      await connectInjected().catch(() => undefined);
      return;
    }

    if (privy?.ready && privy.login) {
      privy.login();
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={connected ? "glass" : "primary"}
      className={cn(
        "group min-w-[8.75rem] select-none justify-between px-3",
        connected && "border border-border/70",
      )}
      disabled={!connected && isConnecting}
      title={connected ? "Right-click or long-press to disconnect" : "Connect wallet"}
      onClick={handleClick}
      onContextMenu={(event) => {
        if (!connected) return;
        event.preventDefault();
        void handleDisconnect();
      }}
      onPointerDown={(event) => {
        if (!connected || event.pointerType === "mouse") return;
        consumedLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
          consumedLongPress.current = true;
          void handleDisconnect();
        }, 650);
      }}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerUp={clearLongPress}
    >
      <span className="flex min-w-0 items-center gap-2">
        {isMiniPay ? <Smartphone className="h-4 w-4 shrink-0" /> : <Wallet className="h-4 w-4 shrink-0" />}
        <span className="truncate">
          {connectedAddress ? truncateAddress(connectedAddress) : isConnecting ? "Connecting" : "Connect"}
        </span>
      </span>
      <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">
        {connected ? badge : privyEnabled ? "Privy" : provider ? "Injected" : "Wallet"}
        {connected ? (
          <Unplug className="hidden h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70 sm:block" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-70" />
        )}
      </span>
    </Button>
  );
}
