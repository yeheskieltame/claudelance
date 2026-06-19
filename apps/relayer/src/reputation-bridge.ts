import type { ChainClient } from './chain.js';
import type { RelayerConfig } from './config.js';
import {
  ackReputation,
  listPendingReputation,
  type AckReputationBody,
  type PendingReputationItem,
} from './coworking.js';

export type Logger = (message: string, meta?: Record<string, unknown>) => void;

const defaultLogger: Logger = (message, meta) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), message, ...meta }));

// Same CELO floor the keeper uses (0.3 CELO). Below it, skip the whole tick so
// the bridge never broadcasts a send the wallet cannot afford.
const LOW_BALANCE_WEI = 300_000_000_000_000_000n;

// How many pending items to drain per workspace per tick. One page keeps the
// tick bounded; the 5-min interval drains any backlog over a few ticks.
const PAGE_LIMIT = 100;

const DEFAULT_TAG2 = '10';
const TAG1 = 'claudelance-coworking';

/**
 * Maps a Coworking task type to its on-chain Claudelance bounty type id (0-10).
 * Mirrors CW_TASKTYPE_TO_BOUNTYTYPE in @yeheskieltame/claudelance-coworking-types,
 * inlined so the relayer image takes no new dependency. PM-native types (bug,
 * design, generic, ...) have no bounty analogue and fall back to DEFAULT_TAG2.
 */
const TASKTYPE_TO_BOUNTYTYPE: Record<string, number> = {
  code: 0,
  data_analysis: 1,
  research: 2,
  content: 3,
  doc_review: 4,
  code_audit: 5,
  translation: 6,
  education: 7,
  legal: 8,
  finance: 9,
  custom: 10,
};

/** tag2 is the mapped bounty-type string, or "10" (Custom) for unmapped types. */
function bountyTypeTag(taskType: string): string {
  const mapped = TASKTYPE_TO_BOUNTYTYPE[taskType];
  return mapped === undefined ? DEFAULT_TAG2 : String(mapped);
}

/** A deep link back to the task that earned the signal, stored as feedbackURI. */
function taskFeedbackUri(item: PendingReputationItem): string {
  return `claudelance-coworking://task/${item.taskId}`;
}

/**
 * Cross-tick bridge state. `cursors` is the per-workspace `since` watermark
 * (review createdAt) advanced only after a successful live ack. `processed` is
 * a Layer-2 in-memory dedup set keyed by reviewId, guarding against a duplicate
 * giveFeedback inside a single process run even before the server-side ack
 * lands. In-memory by design: a restart re-reads from the durable ledger
 * (acked reviews never reappear in the pending feed) so nothing is double-sent.
 */
export type BridgeState = {
  cursors: Map<string, string>;
  processed: Set<string>;
};

export function createBridgeState(): BridgeState {
  return { cursors: new Map(), processed: new Set() };
}

/**
 * Injectable dependencies. Defaults to the real ChainClient + fetch-based
 * coworking client; tests pass in-memory fakes (mirrors keeper.test.ts).
 */
export type BridgeDeps = {
  chain: Pick<ChainClient, 'relayerBalance' | 'relayerAddress' | 'identityOwnerOf' | 'giveFeedback'>;
  listPending: typeof listPendingReputation;
  ack: typeof ackReputation;
};

export type BridgeTickSummary = {
  fetched: number;
  attested: number;
  skipped: number;
  failed: number;
};

/**
 * One bridge pass, on its own clock (NOT inside the keeper tick). For each
 * configured Coworking key (one per workspace): fetch one page of pending
 * approved reviews, and for each owed item record a positive ERC-8004 signal
 * for the assignee's agentId - exactly once.
 *
 * Dry-run (REPUTATION_BRIDGE_DRY_RUN, default TRUE, INDEPENDENT of the keeper's
 * DRY_RUN): log the intended giveFeedback, send nothing, ack nothing, and do
 * NOT advance the durable cursor - so the same items re-list next tick. Going
 * live is an explicit env flip.
 */
export async function runReputationBridgeTick(
  deps: BridgeDeps,
  cfg: RelayerConfig,
  state: BridgeState = createBridgeState(),
  log: Logger = defaultLogger,
): Promise<BridgeTickSummary> {
  const summary: BridgeTickSummary = { fetched: 0, attested: 0, skipped: 0, failed: 0 };

  // Balance floor mirrors the keeper. In dry-run nothing is sent, but a
  // keyless/empty wallet still has nothing to attest with, so skip the tick.
  const balance = await deps.chain.relayerBalance();
  if (balance < LOW_BALANCE_WEI) {
    log('bridge.low-balance', {
      relayer: deps.chain.relayerAddress,
      balanceWei: balance.toString(),
    });
    return summary;
  }

  const baseUrl = cfg.coworkingApiUrl;
  if (!baseUrl) {
    // The config guard prevents this when enabled; defensive only.
    log('bridge.no-url');
    return summary;
  }

  for (let i = 0; i < cfg.coworkingApiKeys.length; i++) {
    const key = cfg.coworkingApiKeys[i] as string;
    // The since cursor is per workspace; key index is its stable handle.
    const cursorKey = String(i);
    const since = state.cursors.get(cursorKey);

    let page;
    try {
      page = await deps.listPending(baseUrl, key, { since, limit: PAGE_LIMIT });
    } catch (err) {
      summary.failed++;
      log('bridge.fetch-error', { workspace: cursorKey, error: errorMessage(err) });
      continue;
    }
    summary.fetched += page.items.length;

    for (const item of page.items) {
      // Layer-2 dedup: a duplicate inside this run, before the server-side ack
      // is observable in a later pending page.
      if (state.processed.has(item.reviewId)) {
        summary.skipped++;
        continue;
      }

      const agentId = parseAgentId(item.agentId);
      if (agentId === null) {
        summary.skipped++;
        log('bridge.bad-agent-id', { reviewId: item.reviewId, agentId: item.agentId });
        continue;
      }

      // Validate the id still resolves to a live Identity NFT. Owner null =>
      // the id does not exist; skip + log, do NOT ack (the review stays owed).
      const owner = await deps.chain.identityOwnerOf(agentId);
      if (owner === null) {
        summary.skipped++;
        log('bridge.agent-unresolvable', {
          reviewId: item.reviewId,
          agentId: item.agentId,
        });
        continue;
      }

      const tag2 = bountyTypeTag(item.taskType);
      const feedbackURI = taskFeedbackUri(item);

      if (cfg.reputationBridgeDryRun) {
        // Observational only: no send, no ack, no cursor advance. The item
        // re-lists next tick until an operator flips REPUTATION_BRIDGE_DRY_RUN.
        log('bridge.dry-run', {
          reviewId: item.reviewId,
          agentId: item.agentId,
          taskType: item.taskType,
          tag1: TAG1,
          tag2,
          feedbackURI,
        });
        continue;
      }

      let tx: `0x${string}`;
      try {
        tx = await deps.chain.giveFeedback(agentId, { tag1: TAG1, tag2, feedbackURI });
      } catch (err) {
        summary.failed++;
        log('bridge.attest-error', {
          reviewId: item.reviewId,
          agentId: item.agentId,
          error: errorMessage(err),
        });
        continue;
      }

      const ackBody: AckReputationBody = { reviewId: item.reviewId, txHash: tx, agentId: item.agentId };
      try {
        await deps.ack(baseUrl, key, ackBody);
      } catch (err) {
        // The signal landed on-chain but the ack failed. Mark it processed in
        // memory so this run does not re-send; the operator can re-ack out of
        // band, and the durable cursor stays put so it is retried next start.
        state.processed.add(item.reviewId);
        summary.failed++;
        log('bridge.ack-error', {
          reviewId: item.reviewId,
          agentId: item.agentId,
          tx,
          error: errorMessage(err),
        });
        continue;
      }

      state.processed.add(item.reviewId);
      state.cursors.set(cursorKey, item.reviewedAt);
      summary.attested++;
      log('bridge.attested', {
        reviewId: item.reviewId,
        agentId: item.agentId,
        tag2,
        tx,
      });
    }
  }

  log('bridge.tick', { ...summary, dryRun: cfg.reputationBridgeDryRun });
  return summary;
}

function parseAgentId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
