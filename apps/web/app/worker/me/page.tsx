"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Loader2, Wallet } from "lucide-react";

import { Header } from "@/components/header";
import { GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function WorkerMePage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  React.useEffect(() => {
    if (isConnected && address) {
      router.replace(`/worker/${address.toLowerCase()}`);
    }
  }, [isConnected, address, router]);

  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-md px-4 pb-20 pt-12">
        <GlassCard className="!p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isConnected ? (
              <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
            ) : (
              <Wallet aria-hidden="true" className="h-6 w-6" />
            )}
          </span>
          <h1 className="mt-4 font-display text-xl font-semibold">
            {isConnected ? "Routing to your dashboard…" : "Connect your wallet"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isConnected
              ? "One redirect away from your earnings + bounty history."
              : "/worker/me is a personalised shortcut. Connect a wallet so we know which address to route to."}
          </p>
          {!isConnected && (
            <Button asChild className="mt-5" size="sm">
              <Link href="/">Go to home</Link>
            </Button>
          )}
        </GlassCard>
      </section>
    </main>
  );
}
