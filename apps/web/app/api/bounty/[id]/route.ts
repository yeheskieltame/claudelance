import { NextResponse, type NextRequest } from "next/server";

import {
  BOUNTY_API_HEADERS,
  BountyApiError,
  fetchBountyDetails,
  parseBountyId,
  parseChainId,
} from "@/lib/bounty-api";

type BountyRouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

export async function OPTIONS() {
  return new Response(null, { headers: BOUNTY_API_HEADERS, status: 204 });
}

export async function GET(request: NextRequest, context: BountyRouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseBountyId(rawId);
    const chainId = parseChainId(request.nextUrl.searchParams);
    const payload = await fetchBountyDetails(id, chainId);

    if (!payload) {
      return NextResponse.json(
        { error: `Bounty ${id.toString()} was not found` },
        { headers: BOUNTY_API_HEADERS, status: 404 },
      );
    }

    return NextResponse.json(payload, { headers: BOUNTY_API_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof BountyApiError) {
    return NextResponse.json({ error: error.message }, { headers: BOUNTY_API_HEADERS, status: error.status });
  }

  console.error("Failed to fetch bounty", error);
  return NextResponse.json(
    { error: "Failed to fetch bounty" },
    { headers: BOUNTY_API_HEADERS, status: 500 },
  );
}
