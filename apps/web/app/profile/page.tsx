import type { Metadata } from "next";

import { ProfileHub } from "@/components/profile/profile-hub";

export const metadata: Metadata = {
  title: "Profile | Claudelance",
  description: "Manage your assets, send cUSD, CELO, or USDC to any address, and claim bounty earnings.",
};

export default function ProfilePage() {
  return <ProfileHub />;
}
