"use client";

import * as React from "react";
import { useMiniPayDetection } from "@/lib/minipay";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { shortAddress } from "@/lib/utils";
import { ChevronDown, LogOut, Wallet } from "lucide-react";

function getChainBadge(chainId: number): string {
  switch (chainId) {
    case 42220:
      return "CELO";
    case 44787:
      return "CELO-α";
    default:
      return `Chain ${chainId}`;
  }
}

function getChainColor(chainId: number): string {
  switch (chainId) {
    case 42220:
      return "text-green-500";
    case 44787:
      return "text-orange-400";
    default:
      return "text-muted-foreground";
  }
}

/**
 * WalletButton — unified wallet connector for MiniPay / Privy / injected.
 *
 * Spec (B51):
 * - Auto-detect MiniPay (no popup) via useMiniPayDetection + eth_requestAccounts
 * - Else open Privy modal
 * - Show connected address (truncated) + chain badge
 * - Disconnect via long-press on mobile / right-click on desktop
 */
export function WalletButton() {
  const isMiniPay = useMiniPayDetection();
  const {
    ready,
    authenticated,
    user,
    connectWallet,
    logout,
  } = usePrivy();

  const [showDropdown, setShowDropdown] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Long-press state for mobile disconnect
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const LONG_PRESS_MS = 500;

  // Right-click handler for desktop disconnect
  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (authenticated) {
        logout().catch(console.error);
      }
    },
    [authenticated, logout]
  );

  // Touch handlers for long-press disconnect on mobile
  const handleTouchStart = React.useCallback(() => {
    if (!authenticated) return;
    longPressTimer.current = setTimeout(() => {
      logout().catch(console.error);
    }, LONG_PRESS_MS);
  }, [authenticated, logout]);

  const handleTouchEnd = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = React.useCallback(() => {
    if (!ready) return;
    if (authenticated) {
      setShowDropdown((prev) => !prev);
    } else {
      if (isMiniPay) {
        // MiniPay auto-connects via useMiniPayDetection + eth_requestAccounts
        // Just open Privy modal to link the account
        connectWallet();
      } else {
        connectWallet();
      }
    }
  }, [ready, authenticated, isMiniPay, connectWallet]);

  const handleCopyAddress = React.useCallback(() => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(user.wallet.address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }, [user?.wallet?.address]);

  if (!ready) {
    return (
      <Button size="sm" disabled className="min-w-[120px]">
        <span className="h-4 w-4 animate-pulse rounded-full bg-current" />
      </Button>
    );
  }

  if (authenticated && user?.wallet) {
    const address = user.wallet.address;
    const chainId = 42220; // default to Celo Mainnet

    return (
      <div className="relative">
        <button
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
          title={authenticated ? "Click to expand • Right-click to disconnect" : ""}
        >
          <Wallet className="h-4 w-4 text-green-500" />
          <span className="font-mono text-xs">{shortAddress(address)}</span>
          <span className={`text-xs font-medium ${getChainColor(chainId)}`}>
            {getChainBadge(chainId)}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-background py-1 shadow-lg">
            <button
              onClick={handleCopyAddress}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {copied ? "Copied!" : "Copy address"}
            </button>
            <button
              onClick={() => { logout().catch(console.error); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not authenticated
  return (
    <Button size="sm" onClick={handleClick} className="min-w-[120px]">
      {isMiniPay ? "Connect MiniPay" : "Connect Wallet"}
    </Button>
  );
}