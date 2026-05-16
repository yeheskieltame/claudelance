"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Rss, Settings, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Bounties", icon: Rss, match: (path: string) => path === "/" },
  {
    href: "/post",
    label: "Post",
    icon: CirclePlus,
    match: (path: string) => path.startsWith("/post"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserRound,
    match: (path: string) => path.startsWith("/profile"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    match: (path: string) => path.startsWith("/settings"),
  },
];

export function BottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 z-50 w-screen border-t border-border/70 bg-background/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-glass backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-12 w-full max-w-xs grid-cols-4 gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={cn(
                "flex h-12 min-w-0 items-center justify-center rounded-xl text-muted-foreground transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
