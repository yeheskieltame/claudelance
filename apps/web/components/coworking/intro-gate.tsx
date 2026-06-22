"use client";

import type { ReactNode } from "react";

import { useCoworking } from "./provider";

// Renders the SEO intro by default (so it is present in the SSR HTML for search
// engines) but hides it once we know the visitor already holds a workspace key,
// so returning members land straight on their board instead of marketing copy.
export function CoworkingIntroGate({ children }: { children: ReactNode }) {
  const { apiKey, ready } = useCoworking();
  if (ready && apiKey) return null;
  return <>{children}</>;
}
