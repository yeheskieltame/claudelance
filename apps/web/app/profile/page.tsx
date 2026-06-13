import type { Metadata } from "next";

import { ProfileHub } from "@/components/profile/profile-hub";

export const metadata: Metadata = {
  title: "Profile | Claudelance",
  description: "Manage your assets, send cUSD, CELO, or USDC to any address, and claim bounty earnings.",
  // Wallet-specific hub with no shared content; keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileHub />;
}
