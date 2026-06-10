import { MAINNET, SEPOLIA, type Deployment } from '@yeheskieltame/claudelance-sdk';

export type NetworkKey = 'celo' | 'sepolia';

export type RelayerConfig = {
  network: NetworkKey;
  deployment: Deployment;
  rpcUrl: string | undefined;
  relayerPrivateKey: `0x${string}` | undefined;
  githubWebhookSecret: string | undefined;
  /** When true, actions are computed and logged but never broadcast. */
  dryRun: boolean;
  port: number;
  keeperIntervalMs: number;
  /** How often the event watcher polls for new logs that trigger an instant tick. */
  eventPollMs: number;
  eventsFromBlock: bigint;
  identityEventsFromBlock: bigint;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseNetwork(value: string | undefined): NetworkKey {
  return value === 'celo' ? 'celo' : 'sepolia';
}

/**
 * Default first block to scan for DeliverableSubmitted logs. On mainnet this is
 * the v3 proxy deploy block, so webhook lookups never reach back toward genesis
 * (forno times out on an unbounded eth_getLogs). 0 is fine for the sparse testnet.
 */
const DEFAULT_EVENTS_FROM_BLOCK: Record<NetworkKey, bigint> = {
  celo: 68_689_178n,
  sepolia: 0n,
};

/**
 * Floor for the agentId mint scan on the ERC-8004 Identity Registry. The
 * mainnet registry went live early Feb 2026 (~block 58M), so no mint can
 * predate it.
 */
const DEFAULT_IDENTITY_FROM_BLOCK: Record<NetworkKey, bigint> = {
  celo: 58_000_000n,
  sepolia: 0n,
};

/**
 * Build the relayer config from the environment. MAINNET / SEPOLIA resolve to
 * the v3 proxy deployments. Fails fast when asked to broadcast (DRY_RUN=false)
 * without a signing key, so a misconfigured deploy never silently runs without
 * the ability to act.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayerConfig {
  const network = parseNetwork(env.RELAYER_NETWORK);
  const deployment = network === 'celo' ? MAINNET : SEPOLIA;
  const dryRun = parseBool(env.DRY_RUN, true);
  const relayerPrivateKey = env.RELAYER_PRIVATE_KEY
    ? (env.RELAYER_PRIVATE_KEY as `0x${string}`)
    : undefined;

  if (!dryRun && !relayerPrivateKey) {
    throw new Error('[relayer] DRY_RUN=false requires RELAYER_PRIVATE_KEY to sign transactions');
  }

  return {
    network,
    deployment,
    rpcUrl: env.RELAYER_RPC_URL || undefined,
    relayerPrivateKey,
    githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET || undefined,
    dryRun,
    port: Number(env.PORT ?? 8787),
    keeperIntervalMs: Number(env.KEEPER_INTERVAL_MS ?? 60_000),
    eventPollMs: Number(env.EVENT_POLL_MS ?? 5_000),
    eventsFromBlock:
      env.EVENTS_FROM_BLOCK !== undefined && env.EVENTS_FROM_BLOCK !== ''
        ? BigInt(env.EVENTS_FROM_BLOCK)
        : DEFAULT_EVENTS_FROM_BLOCK[network],
    identityEventsFromBlock:
      env.IDENTITY_EVENTS_FROM_BLOCK !== undefined && env.IDENTITY_EVENTS_FROM_BLOCK !== ''
        ? BigInt(env.IDENTITY_EVENTS_FROM_BLOCK)
        : DEFAULT_IDENTITY_FROM_BLOCK[network],
  };
}
