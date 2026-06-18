import type { Metadata } from "next";

import { Board } from "@/components/coworking/board";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Board | Coworking",
  description: "Project board - tasks, status, and live activity.",
};

export default async function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <Header />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <Board projectId={projectId} />
      </div>
      <Footer />
    </main>
  );
}
