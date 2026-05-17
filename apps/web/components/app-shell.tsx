import type { ReactNode } from "react";

import { Header } from "@/components/header";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <main
      className={cn(
        "relative isolate min-h-svh overflow-x-clip md:min-h-dvh",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-30 dark:opacity-20" />

      <div className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col md:min-h-dvh md:max-w-none">
        <Header />
        <div className="flex-1">{children}</div>
      </div>
    </main>
  );
}
