"use client";

import * as React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Check, Copy, LayoutDashboard, UserRound } from "lucide-react";

import { Header } from "@/components/header";
import { GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { AssetList } from "@/components/profile/asset-list";
import { SendToken } from "@/components/profile/send-token";
import { ReceiveCard } from "@/components/profile/receive-card";
import { LancePanel } from "@/components/profile/lance-panel";
import { WorkerClaimCard, type ClaimRow } from "@/components/worker-claim-card";
import type { TokenSymbol } from "@/lib/token-theme";
import { shortAddress } from "@/lib/utils";

const DECIMALS: Record<string, number> = { cUSD: 18, CELO: 18, USDC: 6 };

export function ProfileHub() {
  const { address, isConnected } = useAccount();
  const [token, setToken] = React.useState<TokenSymbol>("cUSD");
  const [copied, setCopied] = React.useState(false);
  const [claim, setClaim] = React.useState<ClaimRow[] | null>(null);

  const loadClaim = React.useCallback(async () => {
    if (!address) {
      setClaim(null);
      return;
    }
    try {
      const res = await fetch(`/api/worker/${address.toLowerCase()}`, { cache: "no-store" });
      const data = await res.json();
      const earnings: Array<{ symbol: string; token: string; amount: string }> = Array.isArray(data?.earnings)
        ? data.earnings
        : [];
      setClaim(
        earnings.map((e) => ({
          symbol: e.symbol as ClaimRow["symbol"],
          token: e.token as ClaimRow["token"],
          amount: e.amount,
          decimals: DECIMALS[e.symbol] ?? 18,
        })),
      );
    } catch {
      setClaim([]);
    }
  }, [address]);

  React.useEffect(() => {
    void loadClaim();
  }, [loadClaim]);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  };

  const hasClaimable = (claim ?? []).some((r) => BigInt(r.amount) > 0n);

  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">Profile</p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your wallet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your assets, send tokens to any address, and claim bounty earnings, all in one place.
        </p>

        {!isConnected || !address ? (
          <GlassCard className="mt-6 !p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold">Connect your wallet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect to see balances, send tokens, and claim what you have earned.
            </p>
            <div className="mt-5 flex justify-center">
              <WalletButton />
            </div>
          </GlassCard>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" aria-hidden />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{shortAddress(address)}</p>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                    {copied ? "Copied" : "Copy address"}
                  </button>
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/worker/${address.toLowerCase()}`}>
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Worker dashboard
                </Link>
              </Button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <AssetList onSend={setToken} />
              <SendToken token={token} onTokenChange={setToken} />
            </div>

            <div className="mt-5">
              <LancePanel />
            </div>

            <div className="mt-5">
              <ReceiveCard address={address} />
            </div>

            {hasClaimable ? (
              <div className="mt-5">
                <WorkerClaimCard pageAddress={address} claimable={claim ?? []} onClaimed={loadClaim} />
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
