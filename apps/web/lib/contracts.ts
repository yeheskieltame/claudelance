/**
 * Re-export deployment records and ABI from the canonical types package.
 *
 * All contract addresses, token sets, and the full ClaudelanceCore v2 ABI live
 * in `@yeheskieltame/claudelance-types`. This module re-exports them so the
 * rest of the frontend can import from a single `@/lib/contracts` path.
 */
export {
  CLAUDELANCE_CORE_ABI as coreAbi,
  MAINNET,
  SEPOLIA,
  deploymentByChainId,
  type Deployment,
  type TokenSet,
} from "@yeheskieltame/claudelance-types";

import { deploymentByChainId, type Deployment } from "@yeheskieltame/claudelance-types";

/**
 * Get the deployment record for a chain id, or throw if not found.
 * Convenience wrapper over `deploymentByChainId` that throws instead of
 * returning undefined.
 */
export function getDeployment(chainId: number): Deployment {
  const entry = deploymentByChainId(chainId);
  if (!entry) throw new Error(`No Claudelance deployment for chain ${chainId}`);
  return entry;
}
