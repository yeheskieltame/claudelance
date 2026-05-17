"use client";

import * as React from "react";
import { useAccount, useConnect, useDisconnect, useConnectors } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { Wallet, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isMiniPay } from "@/lib/wallet/config";
import { cn } from "@/lib/utils";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const [mounted, setMounted] = React.useState(false);
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const connectors = useConnectors();
  const { login, authenticated, logout } = usePrivy();

  // Long press refs
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = React.useRef(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Auto-detect MiniPay (no popup auto-connect on mount)
  React.useEffect(() => {
    if (mounted && isMiniPay() && !isConnected) {
      const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (injectedConnector) {
        connect({ connector: injectedConnector });
        toast.success("MiniPay auto-connected seamlessly!");
      }
    }
  }, [mounted, isConnected, connectors, connect]);

  if (!mounted) {
    return (
      <Button
        size="sm"
        disabled
        className={cn("text-xs gap-1.5 glass bg-card/40 border-border/50", className)}
      >
        <Wallet className="h-3.5 w-3.5 animate-pulse text-muted-foreground" />
        Initializing...
      </Button>
    );
  }

  // Resolves whether Privy has a valid app id
  const hasPrivyId =
    process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
    process.env.NEXT_PUBLIC_PRIVY_APP_ID !== "clqy3h0xx00xxxxxxxxxxxxxx";

  // 2. Connect logic: Auto-detect MiniPay or fallback to Privy or Injected
  const handleConnect = () => {
    if (isMiniPay() || !hasPrivyId) {
      // Injected connector directly with no popups
      const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (injectedConnector) {
        connect({ connector: injectedConnector });
        toast.success("Wallet connected via standard injected provider!");
      } else {
        toast.error("No injected wallet provider found. Please use a Web3 browser.");
      }
    } else {
      // Open standard Privy modal
      login();
    }
  };

  // 3. Disconnect logic
  const handleDisconnect = () => {
    if (authenticated) {
      logout();
    }
    disconnect();
    toast.success("Wallet disconnected successfully.");
  };

  // 4. Truncated address formatter
  const formattedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  // ─── Long Press (Mobile) & Right-Click (Desktop) Handlers ───
  const startLongPress = (e: React.PointerEvent | React.TouchEvent) => {
    // Skip if right-click (handled by onContextMenu)
    if ("button" in e && e.button === 2) return;

    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      handleDisconnect();
      // Optional haptic vibration for premium feedback
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(80);
      }
    }, 850); // 850ms hold threshold
  };

  const endLongPress = (e: React.PointerEvent | React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent standard right-click context menu
    handleDisconnect();
  };

  // Render Disconnected State
  if (!isConnected || !address) {
    return (
      <Button
        size="sm"
        onClick={handleConnect}
        className={cn(
          "text-xs gap-1.5 transition-all duration-300 font-medium btn-shine",
          "bg-primary/90 text-primary-foreground hover:bg-primary hover:scale-[1.02]",
          "shadow-glow border border-white/10 dark:border-primary/30",
          className
        )}
      >
        <Wallet className="h-3.5 w-3.5" />
        Connect wallet
      </Button>
    );
  }

  // Get active chain metadata
  const isSepolia = chain?.id === 44787;
  const chainLabel = isSepolia ? "Sepolia" : chain?.name || "Celo";

  return (
    <div className="relative group/wallet inline-flex items-center gap-1.5">
      {/* Dynamic Chain Badge */}
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border tracking-wider uppercase transition-all duration-300",
          isSepolia
            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
        )}
      >
        <ShieldCheck className="h-2.5 w-2.5" />
        {chainLabel}
      </span>

      {/* Interactive Wallet Action Button */}
      <button
        onPointerDown={startLongPress}
        onPointerUp={endLongPress}
        onPointerLeave={endLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        onContextMenu={handleContextMenu}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all duration-300",
          "glass bg-card/60 hover:bg-card border-border/80 hover:border-border select-none outline-none",
          "cursor-pointer active:scale-95 touch-none relative overflow-hidden group",
          className
        )}
        title="Long-press or Right-click to disconnect"
      >
        {/* Pulsing online status indicator */}
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse relative">
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
        </span>
        
        {formattedAddress}

        {/* Floating instructions hint on hover */}
        <span className="hidden md:inline-flex opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0 bg-background/95 items-center justify-center gap-1 font-sans text-[10px] text-muted-foreground font-medium pointer-events-none">
          <LogOut className="h-3 w-3 text-red-500" />
          Right-click to disconnect
        </span>
      </button>

      {/* Mobile-only touch hold guide bubble */}
      <span className="md:hidden opacity-0 group-focus-within/wallet:opacity-100 transition-opacity duration-300 absolute -bottom-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[9px] px-2 py-0.5 rounded shadow border border-border pointer-events-none whitespace-nowrap z-50">
        Hold to disconnect
      </span>
    </div>
  );
}
