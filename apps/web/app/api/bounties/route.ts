import { NextRequest, NextResponse } from "next/server";

import {
  readBountyPage,
  type StatusFilter,
  type TokenFilter,
} from "@/lib/bounty-reads";

// Short window, mirroring the bounty detail fix: the list is the first place
// a poster looks after resolving, and a 30s window kept showing Open.
export const revalidate = 5;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // max-age=0: the focus-refetch in the bounties table must reach the origin,
  // not a 30s browser cache; the short s-maxage keeps RPC load bounded and
  // stale-while-revalidate lets the CDN refresh without blocking readers.
  "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=25",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const parsed = parseQuery(request.nextUrl.searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: corsHeaders });
  }

  const { items, nextCursor } = await readBountyPage(parsed);

  return NextResponse.json({ items, nextCursor }, { headers: corsHeaders });
}

function parseQuery(searchParams: URLSearchParams):
  | {
      status?: StatusFilter;
      token?: TokenFilter;
      limit: number;
      cursor: bigint;
    }
  | { error: string } {
  const status = searchParams.get("status")?.toLowerCase();
  if (status && !["open", "resolved", "cancelled", "expired"].includes(status)) {
    return { error: "status must be open, resolved, cancelled, or expired" };
  }

  const token = searchParams.get("token")?.toLowerCase();
  if (token && token !== "cusd" && token !== "celo" && token !== "usdc") {
    return { error: "token must be cusd, celo, or usdc" };
  }

  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `limit must be an integer from 1 to ${MAX_LIMIT}` };
  }

  const cursorRaw = searchParams.get("cursor");
  let cursor: bigint;
  try {
    cursor = cursorRaw ? BigInt(cursorRaw) : 1n;
  } catch {
    return { error: "cursor must be a positive bounty id" };
  }
  if (cursor < 1n) {
    return { error: "cursor must be a positive bounty id" };
  }

  return {
    status: status as StatusFilter | undefined,
    token: token as TokenFilter | undefined,
    limit,
    cursor,
  };
}
