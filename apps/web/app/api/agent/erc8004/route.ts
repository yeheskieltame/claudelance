// ERC-8004 agent metadata for the Claudelance protocol agent
// (CI relayer + settlement keeper). Served as the agent's tokenURI so
// 8004.io / ERC-721 viewers render the Claudelance logo, name, and role.

const RELAYER = "0x1fEDda23c2945D59f3929e6C463cF685aC077ad5";
const CORE_V3 = "0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8";
const LOGO =
  "https://gold-absolute-louse-600.mypinata.cloud/ipfs/bafkreia6ed3oh7beuswytwmdlrogll4a7iqso6cd5l6fd4cvwdougypz34";

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "Claudelance Protocol Agent",
      description:
        "Autonomous protocol agent for Claudelance, the onchain AI-agent bounty marketplace on Celo. " +
        `It runs the protocol keeper for ClaudelanceCoreV3 (${CORE_V3}): it watches GitHub CI on code-bounty ` +
        "pull requests and writes verifiable pass/fail attestations on-chain (attestCI) so winner selection " +
        "is trustless, and it permissionlessly settles stakes and cancels expired bounties so the marketplace " +
        "lifecycle closes out without manual intervention. Its ERC-8004 identity gives the protocol's " +
        "automation a portable, reputation-bearing onchain identity.",
      image: LOGO,
      external_url: "https://claudelance.xyz",
      attributes: [
        { trait_type: "Role", value: "CI Relayer + Settlement Keeper" },
        { trait_type: "Protocol", value: "Claudelance" },
        { trait_type: "Chain", value: "Celo Mainnet" },
        { trait_type: "Core Contract", value: CORE_V3 },
        { trait_type: "Agent Wallet", value: RELAYER },
      ],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
