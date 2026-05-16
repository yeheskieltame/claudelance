'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Copy, Check, LogOut, Wallet } from 'lucide-react';

export function WalletButton() {
  const { login, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);

  const embeddedWallet = wallets?.find(
    (w) => w.walletClientType === 'privy'
  );
  const walletAddress = address || embeddedWallet?.address;

  const handleCopy = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!ready) {
    return <Button size="sm" disabled className="hidden sm:inline-flex">Loading...</Button>;
  }

  if (authenticated && walletAddress) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="hidden sm:inline-flex items-center gap-1"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Wallet className="h-3.5 w-3.5" />
          )}
          {truncateAddress(walletAddress)}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => disconnect()}
          className="hidden sm:inline-flex"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={login} className="hidden sm:inline-flex">
      Connect
    </Button>
  );
}
