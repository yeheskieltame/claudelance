import { NextResponse } from "next/server";

import { agentManifest, validateAgentManifest } from "@/lib/agent-manifest";

export function GET() {
  const errors = validateAgentManifest(agentManifest);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 500 });
  }

  return NextResponse.json(agentManifest, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}

