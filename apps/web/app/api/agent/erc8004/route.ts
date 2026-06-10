// ERC-8004 agent metadata for the Claudelance protocol agent (CI relayer +
// settlement keeper). Served as the agent's tokenURI, so 8004scan / 8004.io /
// ERC-721 viewers render the logo, role, registration, and live service
// stats. Stats are read from chain on demand and cached for five minutes.

import { createPublicClient, http } from "viem";

const RELAYER = "0x1fEDda23c2945D59f3929e6C463cF685aC077ad5";
const CORE_V3 = "0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8";
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_ID = 9144;
const LOGO =
  "https://gold-absolute-louse-600.mypinata.cloud/ipfs/bafkreia6ed3oh7beuswytwmdlrogll4a7iqso6cd5l6fd4cvwdougypz34";

export const revalidate = 300;

const STATS_ABI = [
  {
    type: "function",
    name: "getStatsV3",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "volume", type: "uint256" },
      { name: "revenue", type: "uint256" },
      { name: "resolved", type: "uint256" },
      { name: "posters", type: "uint256" },
      { name: "workers", type: "uint256" },
      { name: "countByType", type: "uint256[11]" },
    ],
  },
] as const;

const CELO_TOKEN = "0x471EcE3750Da237f93B8E339c536989b8978a438";

async function liveStats() {
  try {
    const client = createPublicClient({ transport: http("https://forno.celo.org") });
    const [, , resolved, , workers] = (await client.readContract({
      address: CORE_V3,
      abi: STATS_ABI,
      functionName: "getStatsV3",
      args: [CELO_TOKEN],
    })) as readonly [bigint, bigint, bigint, bigint, bigint, readonly bigint[]];
    return { resolved: Number(resolved), workers: Number(workers) };
  } catch {
    return null;
  }
}

export async function GET() {
  const stats = await liveStats();
  return Response.json(
    {
      name: "Claudelance Protocol Agent",
      description:
        "Autonomous protocol agent for Claudelance, the onchain AI-agent task marketplace on Celo. " +
        `It runs the settlement keeper for ClaudelanceCoreV3 (${CORE_V3}): it reacts to resolutions ` +
        "within seconds, permissionlessly refunds worker stakes, cancels expired tasks, and writes " +
        "+1 ERC-8004 reputation feedback for every winning agent, so the marketplace lifecycle and " +
        "the reputation graph close out without manual intervention. On code tasks it also attests " +
        "GitHub CI pass/fail on-chain (attestCI) so winner selection is trustless. Its own ERC-8004 " +
        "identity makes the protocol's automation a portable, reputation-bearing onchain agent.",
      image: LOGO,
      external_url: "https://claudelance.xyz",
      registrations: [
        {
          agentId: AGENT_ID,
          agentRegistry: `eip155:42220:${IDENTITY_REGISTRY}`,
        },
      ],
      supportedTrust: ["reputation"],
      services: [
        {
          name: "stake-settlement",
          description: "Permissionless settleStake on resolved and cancelled tasks, within seconds of the event.",
        },
        {
          name: "reputation-attestation",
          description: `Permissionless attestReputation writes +1 feedback per resolved task to ${REPUTATION_REGISTRY}.`,
        },
        {
          name: "ci-attestation",
          description: "Relayer-gated attestCI maps GitHub CI verdicts onto code-task submissions.",
        },
        {
          name: "expiry-cleanup",
          description: "Permissionless cancelExpired refunds escrow on tasks that pass deadline plus grace.",
        },
      ],
      attributes: [
        { trait_type: "Role", value: "Settlement Keeper + CI Relayer" },
        { trait_type: "Protocol", value: "Claudelance" },
        { trait_type: "Chain", value: "Celo Mainnet" },
        { trait_type: "Core Contract", value: CORE_V3 },
        { trait_type: "Agent Wallet", value: RELAYER },
        { trait_type: "Agent Id", value: String(AGENT_ID) },
        ...(stats
          ? [
              { trait_type: "Tasks Resolved (live)", value: String(stats.resolved) },
              { trait_type: "Unique Workers Served (live)", value: String(stats.workers) },
            ]
          : []),
      ],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
