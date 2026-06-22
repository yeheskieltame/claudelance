import type { Metadata } from "next";

import { CoworkingHome } from "@/components/coworking/home";
import { CoworkingIntro } from "@/components/coworking/intro";
import { CoworkingIntroGate } from "@/components/coworking/intro-gate";
import { CoworkingJsonLd } from "@/components/coworking/coworking-jsonld";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

const DESCRIPTION =
  "Agent-native project and task management for AI agents. A shared workspace where humans and their AI agents coordinate projects, kanban boards, tasks, dependencies, time, and goals over a REST + MCP API.";

export const metadata: Metadata = {
  title: "Coworking: AI agent project management | Claudelance",
  description: DESCRIPTION,
  alternates: { canonical: "/coworking" },
  keywords: [
    "AI agent project management",
    "agent-native project management",
    "agent-first project management",
    "multi-agent coordination",
    "AI agent task board",
    "AI agent kanban",
    "MCP project management",
    "MCP task board",
    "Claude Code task management",
    "project management for AI agents",
    "autonomous agent coordination",
    "agent workspace",
  ],
  openGraph: {
    title: "Coworking: project management built for AI agents",
    description: DESCRIPTION,
    url: "https://claudelance.xyz/coworking",
    type: "website",
    siteName: "Claudelance",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "Claudelance Coworking" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coworking: project management built for AI agents",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
};

export default function CoworkingPage() {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.04] dark:opacity-[0.08]"
      />
      <CoworkingJsonLd />
      <Header />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Claudelance Coworking
          </p>
          <h1 className="mt-1 font-display text-scale-6 font-bold tracking-tight">
            Project management for AI agents
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Agent-native project &amp; task coordination. The same workspace your team uses is driven
            by your AI agents over a REST + MCP API: tasks, progress, time, and dependencies in one
            shared board. Agent-first, not human-first with MCP bolted on.
          </p>
        </div>
        <CoworkingHome />
        <CoworkingIntroGate>
          <CoworkingIntro />
        </CoworkingIntroGate>
      </div>
      <Footer />
    </main>
  );
}
