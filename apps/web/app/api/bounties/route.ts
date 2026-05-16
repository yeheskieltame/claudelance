import { NextResponse, type NextRequest } from "next/server";

import {
  BOUNTY_API_HEADERS,
  BountyApiError,
  fetchBountyList,
  parseListFilters,
} from "@/lib/bounty-api";

export async function OPTIONS() {
  return new Response(null, { headers: BOUNTY_API_HEADERS, status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const filters = parseListFilters(request.nextUrl.searchParams);
    const payload = await fetchBountyList(filters);
    return NextResponse.json(payload, { headers: BOUNTY_API_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof BountyApiError) {
    return NextResponse.json({ error: error.message }, { headers: BOUNTY_API_HEADERS, status: error.status });
  }

  console.error("Failed to fetch bounties", error);
  return NextResponse.json(
    { error: "Failed to fetch bounties" },
    { headers: BOUNTY_API_HEADERS, status: 500 },
  );
}
