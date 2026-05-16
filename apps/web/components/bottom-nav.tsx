"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, Settings, SquarePen, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Feed", href: "/", icon: Rss, match: (path: string) => path === "/" },
  { label: "Post", href: "/post", icon: SquarePen, match: startsWith("/post") },
  { label: "Profile", href: "/worker/me", icon: UserCircle, match: startsWith("/worker") },
  { label: "Settings", href: "/settings", icon: Settings, match: startsWith("/settings") },
] as const;

export function BottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/92 px-3 pt-2 shadow-[0_-16px_40px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {navItems.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-muted-foreground transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active && "bg-primary text-primary-foreground shadow-glow",
                )}
              >
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function startsWith(prefix: string) {
  return (path: string) => path === prefix || path.startsWith(`${prefix}/`);
}
