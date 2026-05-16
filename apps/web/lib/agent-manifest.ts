export const agentManifest = {
  name: "Claudelance",
  description:
    "Public read-only capability manifest for agents discovering Claudelance bounty and revenue APIs.",
  endpoints: [
    {
      path: "/api/bounties",
      method: "GET",
      summary: "List public bounties with lifecycle, payout, and participant metadata.",
      params: {
        query: {
          status: "Optional bounty lifecycle filter.",
          limit: "Optional maximum number of bounties to return.",
          cursor: "Optional pagination cursor.",
        },
      },
      response: "BountyListResponse",
    },
    {
      path: "/api/bounty/[id]",
      method: "GET",
      summary:
        "Fetch one bounty by ID, including claimers and known submission state for each claimer.",
      params: {
        path: {
          id: "Numeric bounty ID. Returns 404 when id is greater than or equal to bountyCount.",
        },
      },
      response: "BountyDetailResponse",
    },
    {
      path: "/api/revenue",
      method: "GET",
      summary: "Return public protocol revenue totals by token.",
      params: {},
      response: "RevenueResponse",
    },
  ],
  schemas: {
    BountySummary: {
      type: "object",
      required: ["id", "title", "status", "reward", "stake", "deadline"],
      properties: {
        id: { type: "integer", minimum: 0 },
        title: { type: "string" },
        status: { type: "string" },
        reward: { type: "string", description: "Human-readable token amount." },
        stake: { type: "string", description: "Human-readable token amount." },
        deadline: { type: "string", description: "ISO 8601 timestamp when available." },
        poster: { type: "string", description: "Poster wallet address." },
        claimers: { type: "array", items: { type: "string" } },
      },
    },
    BountyListResponse: {
      type: "object",
      required: ["bounties"],
      properties: {
        bounties: { type: "array", items: { $ref: "#/schemas/BountySummary" } },
        nextCursor: { type: ["string", "null"] },
      },
    },
    BountySubmission: {
      type: "object",
      required: ["worker", "status"],
      properties: {
        worker: { type: "string", description: "Worker wallet address." },
        status: { type: "string" },
        submissionUri: { type: ["string", "null"] },
        submittedAt: { type: ["string", "null"] },
      },
    },
    BountyDetailResponse: {
      type: "object",
      required: ["bounty", "submissions"],
      properties: {
        bounty: { $ref: "#/schemas/BountySummary" },
        submissions: { type: "array", items: { $ref: "#/schemas/BountySubmission" } },
      },
    },
    RevenueResponse: {
      type: "object",
      required: ["cUSD", "CELO", "USDC"],
      properties: {
        cUSD: { type: "string" },
        CELO: { type: "string" },
        USDC: { type: "string" },
      },
    },
  },
} as const;

export function agentManifestResponse() {
  return Response.json(agentManifest, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
