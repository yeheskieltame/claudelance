import { NextResponse } from "next/server";

import { readBountyDetail } from "@/lib/bounty-reads";

// Short window: this is the only cache layer between a fresh submission and
// the poster's screen.
export const revalidate = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // max-age=0: MiniPay's webview must not hold a pre-submission snapshot in
  // the browser cache; the short s-maxage keeps RPC load off the origin.
  "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=25",
};

type Params = Promise<{ id: string }>;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id: rawId } = await params;
  const bountyId = parseBountyId(rawId);
  if (!bountyId) {
    return NextResponse.json({ error: "id must be a positive bounty id" }, { status: 400, headers: corsHeaders });
  }

  const detail = await readBountyDetail(bountyId);
  if (!detail) {
    return NextResponse.json({ error: "bounty not found" }, { status: 404, headers: corsHeaders });
  }

  return NextResponse.json(detail, { headers: corsHeaders });
}

function parseBountyId(value: string) {
  try {
    const id = BigInt(value);
    return id >= 1n ? id : null;
  } catch {
    return null;
  }
}
