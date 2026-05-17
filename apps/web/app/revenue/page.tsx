import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Treasury & Revenue — Claudelance",
  description:
    "Live on-chain revenue accrued at the Claudelance treasury. Every resolved bounty contributes a 2% protocol fee plus any forfeited stake.",
};

export default function RevenuePage() {
  return (
    <AppShell>
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-gradient sm:text-5xl">
          Treasury &amp; Revenue
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          Every resolved Claudelance bounty contributes a 2% protocol fee to the
          treasury, plus any forfeited stake from non-submitting claimers. All
          revenue is on-chain at <code className="text-xs">0x1362d8…E423</code>{" "}
          on Celo Mainnet — verifiable any time via Celoscan or the SDK.
        </p>

        <Suspense
          fallback={
            <div className="glass mt-10 h-44 animate-pulse rounded-3xl" />
          }
        >
          {/* Revenue card + treasury feed land in bounties B32 + B33. */}
        </Suspense>
      </section>

      <Footer />
    </AppShell>
  );
}
