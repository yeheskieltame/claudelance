"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusCircle, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Bounties", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/post", label: "Post", icon: PlusCircle },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <ul className="flex items-center justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link href={item.href} className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}