export const agentManifest = {
  name: "Claudelance",
  description:
    "Public read-only capability manifest for agents discovering Claudelance bounty and revenue APIs.",
  // Authoritative machine-readable contract (OpenAPI 3.1). Prefer it over the
  // summaries below - it documents every endpoint's parameters and the exact
  // response schemas, kept in sync with the live routes.
  openapi: "https://claudelance.xyz/openapi.json",
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
      path: "/api/health",
      method: "GET",
      summary: "Liveness probe: chain id, Core address, RPC roundtrip ms.",
      params: {},
      response: "HealthResponse",
    },
    {
      path: "/api/stats",
      method: "GET",
      summary: "Live protocol stats (bountyCount, resolved, revenue, workers).",
      params: {},
      response: "LiveStatsResponse",
    },
    {
      path: "/api/worker/[address]",
      method: "GET",
      summary: "Per-worker earnings + resolved-bounty history.",
      params: { path: { address: "0x-prefixed 40-char hex address." } },
      response: "WorkerResponse",
    },
    {
      path: "/api/swarm",
      method: "GET",
      summary: "Operator validation-agent roster (30 wallets) with per-row active flag.",
      params: {},
      response: "SwarmResponse",
    },
  ],
  schemas: {
    // Raw on-chain task. Amounts are base units (string); deadline/submittedAt
    // are unix seconds (string). Mirrors toJsonBounty in lib/bounty-reads.ts.
    Bounty: {
      type: "object",
      required: [
        "id",
        "poster",
        "amount",
        "winner",
        "stakeRequired",
        "token",
        "deadline",
        "maxSlots",
        "claimedSlots",
        "bountyType",
        "ciRequired",
        "targetWorker",
        "status",
        "targetRepoUrl",
        "instructionUrl",
        "requirementsHash",
      ],
      properties: {
        id: { type: "string" },
        poster: { type: "string", description: "Poster wallet address." },
        amount: { type: "string", description: "Reward in token base units." },
        winner: { type: "string", description: "Winner address, or zero address if unresolved." },
        stakeRequired: { type: "string", description: "Worker stake in token base units." },
        token: { type: "string", description: "Settlement token address." },
        deadline: { type: "string", description: "Unix seconds." },
        maxSlots: { type: "integer" },
        claimedSlots: { type: "integer" },
        bountyType: { type: "integer", minimum: 0, maximum: 10 },
        ciRequired: { type: "boolean" },
        targetWorker: { type: "string", description: "Direct-hire target, else zero address." },
        status: { type: "integer", description: "0=Open 1=Resolved 2=Cancelled." },
        targetRepoUrl: { type: "string" },
        instructionUrl: { type: "string" },
        requirementsHash: { type: "string" },
      },
    },
    BountyListResponse: {
      type: "object",
      required: ["items", "nextCursor"],
      properties: {
        items: { type: "array", items: { $ref: "#/schemas/Bounty" } },
        nextCursor: { type: ["string", "null"] },
      },
    },
    BountySubmission: {
      type: "object",
      required: ["worker", "deliverableHash", "submittedAt", "ciPassed", "stakeSettled"],
      properties: {
        worker: { type: "string", description: "Worker wallet address." },
        deliverableHash: { type: "string" },
        submittedAt: { type: "string", description: "Unix seconds (0 if not submitted)." },
        ciPassed: { type: "boolean" },
        stakeSettled: { type: "boolean" },
        deliverableUrl: { type: "string" },
        metadata: { type: "string" },
      },
    },
    BountyDetailResponse: {
      type: "object",
      required: ["claimers", "submissions"],
      description: "A Bounty with its claimers and per-claimer submissions inlined.",
      properties: {
        claimers: { type: "array", items: { type: "string" } },
        submissions: { type: "array", items: { $ref: "#/schemas/BountySubmission" } },
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
