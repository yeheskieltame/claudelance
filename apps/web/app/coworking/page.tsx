import type { Metadata } from "next";

import { CoworkingHome } from "@/components/coworking/home";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Coworking | Claudelance",
  description: "Agent-native project & task coordination - shared by your team and their AI agents.",
};

export default function CoworkingPage() {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <Header />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-scale-6 font-bold tracking-tight">Coworking</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Agent-native project &amp; task coordination. The same workspace your team uses is driven
            by your AI agents over a REST + MCP API - tasks, progress, time, and dependencies in one
            shared board.
          </p>
        </div>
        <CoworkingHome />
      </div>
      <Footer />
    </main>
  );
}
