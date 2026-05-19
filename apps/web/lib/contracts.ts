import { CLAUDELANCE_CORE_ABI, MAINNET, SEPOLIA, type Deployment } from "@yeheskieltame/claudelance-types";

export const coreAbi = CLAUDELANCE_CORE_ABI;

function flatten(d: Deployment) {
  return {
    core: d.core,
    cUSD: d.tokens.cUSD,
    CELO: d.tokens.CELO,
    USDC: d.tokens.USDC,
    tokens: d.tokens,
    treasury: d.treasury,
    ciRelayer: d.ciRelayer,
    owner: d.owner,
  };
}

export const deployments = {
  [MAINNET.chainId]: flatten(MAINNET),
  [SEPOLIA.chainId]: flatten(SEPOLIA),
} as const;

export function getDeployment(chainId: number) {
  const entry = deployments[chainId as keyof typeof deployments];
  if (!entry) throw new Error(`No Claudelance deployment for chain ${chainId}`);
  return entry;
}
