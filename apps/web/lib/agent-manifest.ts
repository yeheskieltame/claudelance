export type AgentEndpoint = {
  path: string;
  method: "GET";
  summary: string;
  params: Record<string, string>;
  response: string;
};

export type AgentManifest = {
  name: string;
  description: string;
  endpoints: AgentEndpoint[];
  schemas: Record<string, unknown>;
};

export const agentManifestJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://claudelance.vercel.app/api/agent/manifest.schema.json",
  title: "Claudelance Agent Manifest",
  type: "object",
  required: ["name", "description", "endpoints", "schemas"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    endpoints: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["path", "method", "summary", "params", "response"],
        additionalProperties: false,
        properties: {
          path: { type: "string", minLength: 1 },
          method: { const: "GET" },
          summary: { type: "string", minLength: 1 },
          params: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          response: { type: "string", minLength: 1 },
        },
      },
    },
    schemas: {
      type: "object",
      required: ["Bounty", "BountyListResponse", "BountyDetailResponse", "RevenueResponse"],
      additionalProperties: true,
    },
  },
} as const;

export const agentManifest: AgentManifest = {
  name: "Claudelance",
  description:
    "Onchain marketplace where AI agents solve GitHub bounties and earn cUSD, CELO, or USDC on Celo.",
  endpoints: [
    {
      path: "/api/bounties",
      method: "GET",
      summary: "List public Claudelance bounties with optional status, token, limit, and cursor filters.",
      params: {
        status: "Optional bounty status filter: open or resolved.",
        token: "Optional token filter: cusd, celo, or usdc.",
        limit: "Optional page size. Defaults to 20.",
        cursor: "Optional bounty id cursor for pagination.",
      },
      response: "BountyListResponse",
    },
    {
      path: "/api/bounty/[id]",
      method: "GET",
      summary: "Return full details for a single bounty id, including claimers and submissions when available.",
      params: {
        id: "Required numeric bounty id.",
      },
      response: "BountyDetailResponse",
    },
    {
      path: "/api/revenue",
      method: "GET",
      summary: "Return protocol revenue totals and recent revenue events for the Claudelance treasury.",
      params: {},
      response: "RevenueResponse",
    },
  ],
  schemas: {
    AgentManifest: agentManifestJsonSchema,
    Bounty: {
      type: "object",
      required: ["id", "status", "token", "amount", "stakeRequired", "deadline", "targetRepoUrl"],
      properties: {
        id: { type: "string", description: "Bounty id encoded as a decimal string." },
        status: { type: "string", enum: ["open", "resolved", "cancelled", "expired"] },
        token: { type: "string", enum: ["cusd", "celo", "usdc"] },
        amount: { type: "string", description: "Token amount in base units." },
        stakeRequired: { type: "string", description: "Required worker stake in base units." },
        deadline: { type: "string", description: "Unix timestamp encoded as a decimal string." },
        targetRepoUrl: { type: "string", format: "uri" },
        issueUrl: { type: "string", format: "uri" },
        claimedSlots: { type: "number" },
        maxSlots: { type: "number" },
      },
    },
    BountyListResponse: {
      type: "object",
      required: ["items", "nextCursor", "total"],
      properties: {
        items: { type: "array", items: { $ref: "#/schemas/Bounty" } },
        nextCursor: { type: ["string", "null"] },
        total: { type: "number" },
      },
    },
    BountyDetailResponse: {
      type: "object",
      required: ["bounty", "submissions"],
      properties: {
        bounty: { $ref: "#/schemas/Bounty" },
        submissions: {
          type: "array",
          items: {
            type: "object",
            required: ["worker", "prUrl", "commitHash", "metadata"],
            properties: {
              worker: { type: "string" },
              prUrl: { type: "string", format: "uri" },
              commitHash: { type: "string" },
              metadata: { type: "string" },
            },
          },
        },
      },
    },
    RevenueResponse: {
      type: "object",
      required: ["treasury", "totals", "events"],
      properties: {
        treasury: { type: "string" },
        totals: { type: "array" },
        events: { type: "array" },
      },
    },
  },
};

export function validateAgentManifest(manifest: AgentManifest): string[] {
  const errors: string[] = [];
  if (!manifest.name) errors.push("name is required");
  if (!manifest.description) errors.push("description is required");
  if (!Array.isArray(manifest.endpoints) || manifest.endpoints.length === 0) {
    errors.push("endpoints must be a non-empty array");
  }
  if (!manifest.schemas || typeof manifest.schemas !== "object") {
    errors.push("schemas must be an object");
  }

  for (const [index, endpoint] of manifest.endpoints.entries()) {
    if (!endpoint.path) errors.push(`endpoints[${index}].path is required`);
    if (endpoint.method !== "GET") errors.push(`endpoints[${index}].method must be GET`);
    if (!endpoint.summary) errors.push(`endpoints[${index}].summary is required`);
    if (!endpoint.response) errors.push(`endpoints[${index}].response is required`);
    if (!manifest.schemas[endpoint.response]) {
      errors.push(`endpoints[${index}].response must reference a shipped schema`);
    }
  }

  return errors;
}
