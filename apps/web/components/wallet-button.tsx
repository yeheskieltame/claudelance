"use client";

import { useCallback, useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WalletState = "disconnected" | "connecting" | "connected";

export type WalletButtonProps = {
  className?: string;
  onConnect?: () => Promise<string | undefined>;
  onDisconnect?: () => void;
  address?: string;
};

export function WalletButton({
  className,
  onConnect,
  onDisconnect,
  address: externalAddress,
}: WalletButtonProps) {
  const [state, setState] = useState<WalletState>("disconnected");
  const [address, setAddress] = useState<string | undefined>(externalAddress);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = useCallback(async () => {
    setState("connecting");
    try {
      if (onConnect) {
        const addr = await onConnect();
        setAddress(addr);
      }
      setState("connected");
    } catch {
      setState("disconnected");
    }
  }, [onConnect]);

  const handleDisconnect = useCallback(() => {
    onDisconnect?.();
    setAddress(undefined);
    setState("disconnected");
    setShowDropdown(false);
  }, [onDisconnect]);

  const handleCopy = useCallback(async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  if (state === "disconnected") {
    return (
      <Button
        onClick={handleConnect}
        className={cn("gap-2", className)}
        variant="default"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  if (state === "connecting") {
    return (
      <Button disabled className={cn("gap-2", className)}>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        Connecting...
      </Button>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-card"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {shortAddress}
        <ChevronDown className={cn("h-4 w-4 transition", showDropdown && "rotate-180")} />
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-glass-strong backdrop-blur">
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
