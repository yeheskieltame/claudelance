import { agentManifestResponse } from "@/lib/agent-manifest";

export const dynamic = "force-static";

export function GET() {
  return agentManifestResponse();
}
