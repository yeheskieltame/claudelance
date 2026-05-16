"use client";

import * as React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isMiniPay } from "@/lib/wallet/config";

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      if (isMiniPay()) {
        const injected = connectors.find((c) => c.id === "injected" || c.name === "MiniPay");
        if (injected) await connectAsync({ connector: injected });
      } else {
        const privy = connectors.find((c) => c.id.includes("privy"));
        if (privy) await connectAsync({ connector: privy });
        else {
          const injected = connectors.find((c) => c.type === "injected");
          if (injected) await connectAsync({ connector: injected });
        }
      }
    } catch {}
    setIsLoading(false);
  };

  const handleDisconnect = async () => {
    await disconnectAsync();
  };

  const truncate = (addr: string) => addr.slice(0, 6) + "..." + addr.slice(-4);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-foreground sm:inline-block">
          {truncate(address)}
        </span>
        <Button size="sm" variant="ghost" onClick={handleDisconnect} aria-label="Disconnect wallet">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={handleConnect} disabled={isLoading} className="gap-2">
      <Wallet className="h-4 w-4" />
      {isLoading ? "Connecting..." : "Connect"}
    </Button>
  );
}