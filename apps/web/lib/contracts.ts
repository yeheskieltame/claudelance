import deployment from "../../../contracts/deployments/celo-sepolia.json";
import { celoSepolia } from "./chain";

/// Static deployment metadata pulled from the committed deployment record.
/// Importing JSON keeps the frontend in lockstep with the contract repo — the
/// next mainnet deploy adds celo-mainnet.json and we add a sibling import.
export const deployments = {
  [celoSepolia.id]: {
    core: deployment.core as `0x${string}`,
    cUSD: deployment.tokens.cUSD as `0x${string}`,
    treasury: deployment.treasury as `0x${string}`,
    ciRelayer: deployment.ciRelayer as `0x${string}`,
    owner: deployment.owner as `0x${string}`,
  },
} as const;

export function getDeployment(chainId: number) {
  const entry = deployments[chainId as keyof typeof deployments];
  if (!entry) throw new Error(`No Claudelance deployment for chain ${chainId}`);
  return entry;
}

/// Minimal ClaudelanceCore ABI surface — read-only views the frontend needs for
/// dashboards. Write-side ABI lives next to the post-bounty / claim flows so
/// each route ships only the calls it actually invokes.
export const coreAbi = [
  {
    type: "function",
    name: "bountyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalBountyVolume",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalProtocolRevenue",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalBountiesResolved",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "uniquePosterCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "uniqueWorkerCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "PROTOCOL_FEE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "RESOLUTION_GRACE_PERIOD",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
] as const;
