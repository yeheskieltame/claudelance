"use client";

import type { ReactNode } from "react";

import { CoworkingProvider } from "@/components/coworking/provider";

export default function CoworkingLayout({ children }: { children: ReactNode }) {
  return <CoworkingProvider>{children}</CoworkingProvider>;
}
