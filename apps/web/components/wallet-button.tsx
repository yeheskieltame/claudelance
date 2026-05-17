"use client";

import * as React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Wallet, ChevronDown, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMiniPayDetection } from "@/lib/minipay";
import { cn } from "@/lib/utils";

/**
 * WalletButton — unified wallet connector for MiniPay / injected.
 *
 * Spec (B51):
 * - Auto-detect MiniPay (no popup) via useMiniPayDetection + injected connector
 * - Falls back to first available connector
 * - Show connected address (truncated) + chain badge
 * - Disconnect via long-press on mobile / right-click on desktop
 */
export function WalletButton({ className }: { className?: string }) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const isMiniPay = useMiniPayDetection();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isLongPressing, setIsLongPressing] = React.useState(false);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConnect = React.useCallback(() => {
    if (isMiniPay) {
      const injectedConnector = connectors.find((c) => c.id === "injected");
      if (injectedConnector) {
        connect({ connector: injectedConnector });
        return;
      }
    }
    if (connectors.length > 0) {
      connect({ connector: connectors[0] as Parameters<typeof connect>[0]["connector"] });
    }
  }, [isMiniPay, connectors, connect]);

  const handleDisconnect = React.useCallback(() => {
    disconnect();
    setShowDropdown(false);
  }, [disconnect]);

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const chainBadge = (() => {
    if (!chain) return null;
    const name =
      chain.name === "Celo Sepolia" ? "Sepolia" :
      chain.name === "Celo" ? "Celo" :
      chain.name;
    return (
      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
        {name}
      </span>
    );
  })();

  if (isConnected && address) {
    return (
      <div className={cn("relative", className)} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown((v) => !v)}
          onContextMenu={(e) => {
            e.preventDefault();
            handleDisconnect();
          }}
          onTouchStart={() => {
            longPressTimerRef.current = setTimeout(() => {
              handleDisconnect();
            }, 600);
            setIsLongPressing(true);
          }}
          onTouchEnd={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            setIsLongPressing(false);
          }}
          onTouchCancel={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            setIsLongPressing(false);
          }}
          className={cn(
            "flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-medium transition-all",
            "hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isLongPressing && "scale-95",
          )}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="font-mono text-xs">{truncateAddress(address)}</span>
          {chainBadge}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              showDropdown && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-border bg-background shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <p className="font-mono text-xs text-muted-foreground">{truncateAddress(address)}</p>
              {chainBadge && <div className="mt-1">{chainBadge}</div>}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleConnect}
      disabled={isPending}
      className={cn("gap-2", className)}
    >
      <Wallet className="h-4 w-4" aria-hidden="true" />
      {isPending ? "Connecting…" : "Connect"}
    </Button>
  );
}