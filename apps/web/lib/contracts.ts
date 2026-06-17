import {
  CLAUDELANCE_CORE_V3_ABI,
  MAINNET_V3,
  MAINNET_V2,
  type Deployment,
} from "@yeheskieltame/claudelance-types";

/** Default ABI for ClaudelanceCore - v3 (UUPS proxy). */
export const coreAbi = CLAUDELANCE_CORE_V3_ABI;

function flatten(d: Deployment) {
  return {
    core: d.core,
    version: d.version,
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
  [MAINNET_V3.chainId]: flatten(MAINNET_V3),
} as const;

/** @deprecated Use deployments[chainId] - kept for backward compat. */
export const MAINNET_FLAT = flatten(MAINNET_V2);

export function getDeployment(chainId: number) {
  const entry = deployments[chainId as keyof typeof deployments];
  if (!entry) throw new Error(`No Claudelance deployment for chain ${chainId}`);
  return entry;
}
