import type { Metadata } from "next";

import { BountyDetailPage } from "@/components/bounty-detail-page";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

export const metadata: Metadata = {
  title: "Bounty Detail - Claudelance",
  description: "Review a Claudelance bounty and take the next onchain action.",
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <BountyDetailPage bountyId={id} />;
}
