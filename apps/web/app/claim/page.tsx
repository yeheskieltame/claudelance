"use client";

import * as React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Coins, Loader2 } from "lucide-react";

import { Header } from "@/components/header";
import { GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { WorkerClaimCard, type ClaimRow } from "@/components/worker-claim-card";

const DECIMALS: Record<string, number> = { cUSD: 18, CELO: 18, USDC: 6 };

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const [rows, setRows] = React.useState<ClaimRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!address) {
      setRows(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/worker/${address.toLowerCase()}`, { cache: "no-store" });
      const data = await res.json();
      const earnings: Array<{ symbol: string; token: string; amount: string }> = Array.isArray(data?.earnings)
        ? data.earnings
        : [];
      setRows(
        earnings.map((e) => ({
          symbol: e.symbol as ClaimRow["symbol"],
          token: e.token as ClaimRow["token"],
          amount: e.amount,
          decimals: DECIMALS[e.symbol] ?? 18,
        })),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const hasClaimable = (rows ?? []).some((r) => BigInt(r.amount) > 0n);

  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-xl px-4 pb-24 pt-10">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">Worker</p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">Claim rewards</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pull your won bounty rewards to your wallet. Connect the wallet you worked with.
        </p>

        <div className="mt-6">
          {!isConnected ? (
            <GlassCard className="!p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Coins className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold">Connect your wallet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect the worker wallet to see what you can claim. Only that wallet can withdraw its own rewards.
              </p>
              <div className="mt-5 flex justify-center">
                <WalletButton />
              </div>
            </GlassCard>
          ) : loading || rows === null ? (
            <GlassCard className="!p-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">Checking your claimable rewards...</p>
            </GlassCard>
          ) : hasClaimable ? (
            <WorkerClaimCard pageAddress={address!} claimable={rows} onClaimed={load} />
          ) : (
            <GlassCard className="!p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Coins className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold">Nothing to claim</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You have not won a bounty with unclaimed rewards yet. Win one and it shows up here, ready to pull.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild size="sm">
                  <Link href="/bounties">Browse bounties</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/worker/${address!.toLowerCase()}`}>My dashboard</Link>
                </Button>
              </div>
            </GlassCard>
          )}
        </div>
      </section>
    </main>
  );
}
