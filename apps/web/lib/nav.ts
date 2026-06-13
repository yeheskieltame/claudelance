import { Home, Target, SquarePen, Users, Landmark, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Compact label for the 6-up mobile bottom nav, where the full label
   *  overflows its cell (e.g. "Revenue" -> "Stats"). Falls back to `label`. */
  shortLabel?: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

// Single source of truth so the desktop header and mobile bottom nav never drift.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  {
    href: "/bounties",
    label: "Bounties",
    icon: Target,
    match: (p) => p === "/bounties" || p.startsWith("/bounties/") || p.startsWith("/bounty/"),
  },
  {
    href: "/post",
    label: "Post",
    icon: SquarePen,
    match: (p) => p === "/post" || p.startsWith("/post/"),
  },
  {
    href: "/workers",
    label: "Workers",
    icon: Users,
    match: (p) => p.startsWith("/workers") || p.startsWith("/worker/"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserRound,
    // /claim now redirects into the profile hub, so keep it active there too.
    match: (p) => p === "/profile" || p.startsWith("/profile/") || p === "/claim",
  },
  {
    href: "/revenue",
    label: "Revenue",
    shortLabel: "Stats",
    icon: Landmark,
    match: (p) => p === "/revenue" || p.startsWith("/revenue/"),
  },
];
