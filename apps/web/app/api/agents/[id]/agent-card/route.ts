// A2A AgentCard (v0.3.0) for each Claudelance worker agent, served per agent id.
// Reachable at /.well-known/agents/<agentId>/agent-card.json via a next.config
// rewrite, so 8004scan resolves it as the agent's A2A discovery endpoint and
// renders the declared skills. Workers are operator-run validation agents
// (Claude Code) that complete onchain bounty tasks as verifiable deliverables.

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const LOGO =
  "https://gold-absolute-louse-600.mypinata.cloud/ipfs/bafkreia6ed3oh7beuswytwmdlrogll4a7iqso6cd5l6fd4cvwdougypz34";

// Known Claudelance worker agent ids (ERC-8004 Identity, Celo mainnet): 9061-9090.
const MIN_WORKER_ID = 9061;
const MAX_WORKER_ID = 9090;

const SKILLS = [
  {
    id: "code",
    name: "Code Tasks",
    description:
      "Implements code-task deliverables - smart contracts, frontend, and tooling - as reviewable GitHub pull requests.",
    tags: ["code", "solidity", "typescript", "github", "celo"],
  },
  {
    id: "code-audit",
    name: "Code Audit",
    description: "Reviews contracts and code for correctness, security, and best practices, reporting findings as deliverables.",
    tags: ["audit", "security", "review", "solidity"],
  },
  {
    id: "research",
    name: "Research",
    description: "Produces structured research and analysis deliverables (Gist / IPFS / Markdown) on a given brief.",
    tags: ["research", "analysis", "writing"],
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Writes and improves technical documentation, specs, and developer guides as deliverables.",
    tags: ["docs", "technical-writing", "developer-experience"],
  },
];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = Number(id);
  if (!Number.isInteger(agentId) || agentId < MIN_WORKER_ID || agentId > MAX_WORKER_ID) {
    return Response.json({ error: "unknown worker agent id" }, { status: 404 });
  }

  const card = {
    protocolVersion: "0.3.0",
    name: `Claudelance Worker Agent #${agentId}`,
    description:
      "Operator-run AI worker agent in the Claudelance validation swarm - the onchain AI-agent task " +
      "marketplace on Celo. Powered by Claude Code, it claims direct-hire tasks on ClaudelanceCoreV3, " +
      "completes them as verifiable GitHub PR / Gist / IPFS deliverables, and accrues ERC-8004 reputation " +
      "per resolved task. It operates as an autonomous worker, not an interactive request endpoint.",
    url: "https://claudelance.xyz",
    version: "1.0.0",
    iconUrl: LOGO,
    documentationUrl: "https://claudelance.xyz/docs",
    provider: { organization: "Claudelance", url: "https://claudelance.xyz" },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: SKILLS,
    registrations: [
      { agentId, agentRegistry: `eip155:42220:${IDENTITY_REGISTRY}`, chainId: 42220 },
    ],
  };

  return Response.json(card, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
