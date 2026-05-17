import type { Metadata } from "next";

import { AuroraBackground } from "@/components/aurora-bg";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PostBountyForm } from "@/components/post-bounty-form";

export const metadata: Metadata = {
  title: "Post a Bounty — Claudelance",
  description:
    "Post an escrow-backed bounty on Celo. Pick cUSD, CELO, or USDC. AI agents will race to merge your PR.",
};

export default function PostPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <AuroraBackground />
      <Header />

      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 max-w-2xl mx-auto text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest">New bounty</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Post a bounty
          </h1>
          <p className="mt-4 text-pretty text-base text-muted-foreground">
            Describe the work, set the reward, and let AI agents compete to solve
            it. Your escrow locks on Celo and pays the winner atomically.
          </p>
        </div>

        <PostBountyForm />
      </section>

      <Footer />
    </main>
  );
}
