import { MAINNET, type Deployment } from '@yeheskieltame/claudelance-sdk';

export type NetworkKey = 'celo';

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
  /**
   * Warn-below threshold for the keeper's native CELO balance, in wei. Gas
   * spikes have starved the signer before, so each tick logs a warning when the
   * balance drops under this floor (default 0.6 CELO) before writes start to
   * revert. Set via KEEPER_MIN_BALANCE_CELO (a decimal CELO amount).
   */
  keeperMinBalanceWei: bigint;
  /** How often the event watcher polls for new logs that trigger an instant tick. */
  eventPollMs: number;
  eventsFromBlock: bigint;
  identityEventsFromBlock: bigint;
  /** Base URL of the off-chain Coworking API (the reputation bridge source). */
  coworkingApiUrl: string | undefined;
  /**
   * Admin-scoped Coworking API keys, one per workspace the bridge serves
   * (COWORKING_API_KEYS, comma-split). Each key is a Bearer token over plain HTTP.
   */
  coworkingApiKeys: string[];
  /**
   * Master switch for the Coworking -> ERC-8004 reputation write-back bridge.
   * Default FALSE: the bridge job is not even scheduled unless this is true.
   */
  reputationBridgeEnabled: boolean;
  /**
   * Bridge dry-run. INDEPENDENT of the keeper's `dryRun` so the bridge can ship
   * dormant while the keeper runs live. Default TRUE: log the intended
   * giveFeedback, never send, never ack. Going live is an explicit env flip.
   */
  reputationBridgeDryRun: boolean;
  /** How often the bridge polls Coworking for pending reputation write-backs. */
  reputationBridgeIntervalMs: number;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseNetwork(_value: string | undefined): NetworkKey {
  // Celo Mainnet (chain 42220) is the only supported network.
  return 'celo';
}

/**
 * Parse a decimal CELO amount (e.g. "0.6") into wei. Falls back to `fallback`
 * on an empty or non-finite value so a typo never silently disables the alert.
 */
function parseCeloToWei(value: string | undefined, fallback: bigint): bigint {
  if (value === undefined || value.trim() === '') return fallback;
  const celo = Number(value);
  if (!Number.isFinite(celo) || celo < 0) return fallback;
  return BigInt(Math.round(celo * 1e9)) * 1_000_000_000n; // 1e9 * 1e9 = 1e18, no float wei
}

/**
 * Default first block to scan for DeliverableSubmitted logs. This is the v3
 * mainnet proxy deploy block, so webhook lookups never reach back toward genesis
 * (forno times out on an unbounded eth_getLogs).
 */
const DEFAULT_EVENTS_FROM_BLOCK: Record<NetworkKey, bigint> = {
  celo: 68_689_178n,
};

/**
 * Floor for the agentId mint scan on the ERC-8004 Identity Registry. The
 * mainnet registry went live early Feb 2026 (~block 58M), so no mint can
 * predate it.
 */
const DEFAULT_IDENTITY_FROM_BLOCK: Record<NetworkKey, bigint> = {
  celo: 58_000_000n,
};

/**
 * Build the relayer config from the environment. Mainnet only: MAINNET resolves
 * to the v3 proxy deployment. Fails fast when asked to broadcast (DRY_RUN=false)
 * without a signing key, so a misconfigured deploy never silently runs without
 * the ability to act.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayerConfig {
  const network = parseNetwork(env.RELAYER_NETWORK);
  const deployment = MAINNET;
  const dryRun = parseBool(env.DRY_RUN, true);
  const relayerPrivateKey = env.RELAYER_PRIVATE_KEY
    ? (env.RELAYER_PRIVATE_KEY as `0x${string}`)
    : undefined;

  if (!dryRun && !relayerPrivateKey) {
    throw new Error('[relayer] DRY_RUN=false requires RELAYER_PRIVATE_KEY to sign transactions');
  }

  const coworkingApiUrl = env.COWORKING_API_URL || undefined;
  const coworkingApiKeys = (env.COWORKING_API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k !== '');
  const reputationBridgeEnabled = parseBool(env.REPUTATION_BRIDGE_ENABLED, false);
  const reputationBridgeDryRun = parseBool(env.REPUTATION_BRIDGE_DRY_RUN, true);

  if (reputationBridgeEnabled && (!coworkingApiUrl || coworkingApiKeys.length === 0)) {
    throw new Error(
      '[relayer] REPUTATION_BRIDGE_ENABLED requires COWORKING_API_URL and a non-empty COWORKING_API_KEYS',
    );
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
    keeperMinBalanceWei: parseCeloToWei(env.KEEPER_MIN_BALANCE_CELO, 600_000_000_000_000_000n), // 0.6 CELO
    eventPollMs: Number(env.EVENT_POLL_MS ?? 5_000),
    eventsFromBlock:
      env.EVENTS_FROM_BLOCK !== undefined && env.EVENTS_FROM_BLOCK !== ''
        ? BigInt(env.EVENTS_FROM_BLOCK)
        : DEFAULT_EVENTS_FROM_BLOCK[network],
    identityEventsFromBlock:
      env.IDENTITY_EVENTS_FROM_BLOCK !== undefined && env.IDENTITY_EVENTS_FROM_BLOCK !== ''
        ? BigInt(env.IDENTITY_EVENTS_FROM_BLOCK)
        : DEFAULT_IDENTITY_FROM_BLOCK[network],
    coworkingApiUrl,
    coworkingApiKeys,
    reputationBridgeEnabled,
    reputationBridgeDryRun,
    reputationBridgeIntervalMs: Number(env.REPUTATION_BRIDGE_INTERVAL_MS ?? 300_000),
  };
}
