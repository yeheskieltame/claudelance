/**
 * Live Claudelance deployment records. Celo mainnet only (chain 42220).
 *
 * Source of truth lives in `contracts/deployments/celo-mainnet.json`
 * within the monorepo; this module mirrors those records for npm consumers.
 *
 * UUPS upgradeable proxy, 10 task types, submitDeliverable, EIP-7201 storage.
 */

export type TokenSet = {
  /** Celo Dollar stablecoin. */
  cUSD: `0x${string}`;
  /** CELO ERC20. */
  CELO: `0x${string}`;
  /** USDC. */
  USDC: `0x${string}`;
};

export type Deployment = {
  /** EVM chain id. */
  chainId: number;
  /** Human-readable chain name. */
  chainName: string;
  /** ClaudelanceCore v3 proxy address. */
  core: `0x${string}`;
  /** Implementation address behind the v3 UUPS proxy. */
  implementation?: `0x${string}`;
  /** Contract version (v3 UUPS proxy). */
  version: 'v3';
  /** Allowed escrow tokens at the time of deploy. Admin can `allowToken` more. */
  tokens: TokenSet;
  /** ERC-8004 Identity Registry (workers must hold an NFT here to claimSlot). */
  identityRegistry: `0x${string}`;
  /** ERC-8004 Reputation Registry (read for worker scores; feedback writes in Phase 2). */
  reputationRegistry: `0x${string}`;
  /** Owner address (EOA, multisig, or governance contract). */
  owner: `0x${string}`;
  /** Treasury - collects 2% protocol fee + forfeited stakes via pull pattern. */
  treasury: `0x${string}`;
  /** Relayer that signs `attestCI` calls. */
  ciRelayer: `0x${string}`;
  /** Explorer URL for the core contract (verified source page). */
  explorerUrl: string;
};

// ─── v3 (UUPS proxy, 10 task types) ──────────────────────────────────────────

export const MAINNET_V3: Deployment = {
  chainId: 42220,
  chainName: 'celo-mainnet',
  version: 'v3',
  core: '0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8',
  implementation: '0x92b7d04E9A3fa3C96bfc891D8E8dB61Fe6C1D49C',
  tokens: {
    cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    CELO: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  },
  identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  owner: '0xe9Fc48f315fD4E989637fAcC29AaF2717E19f7F0',
  treasury: '0xCC0cCac212999612BdDdEb607B33CC1a46F8A401',
  ciRelayer: '0x1fEDda23c2945D59f3929e6C463cF685aC077ad5',
  explorerUrl: 'https://celoscan.io/address/0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8#code',
};

// ─── Default exports - v3 is the current target ──────────────────────────────

/** Default Celo Mainnet deployment (v3 proxy). */
export const MAINNET: Deployment = MAINNET_V3;

/** Look up the deployment by chain id. Mainnet only (chain 42220). */
export function deploymentByChainId(chainId: number): Deployment | undefined {
  if (chainId === 42220) return MAINNET_V3;
  return undefined;
}
