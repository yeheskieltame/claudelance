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

// How many pending items to fetch per page. Each tick drains ALL pages for a
// workspace (paginating within the tick via the response cursor), so this only
// bounds a single HTTP round trip, not the total work per tick.
const PAGE_LIMIT = 100;

// Hard cap on pages drained per workspace per tick. The server set-minus shrinks
// as we ack, so pagination terminates well before this; the cap is a belt-and-
// suspenders guard against an unexpected non-advancing cursor.
const MAX_PAGES_PER_TICK = 1_000;

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
 * Cross-tick bridge state. `processed` is an in-memory dedup set keyed by
 * reviewId, guarding against a duplicate giveFeedback inside a single process
 * run before the server-side ack is observable in a later pending page.
 *
 * There is deliberately NO persisted `since` cursor: /v1/reputation/pending is
 * an authoritative server-side set-minus (acked reviews are excluded by the
 * ledger anti-join), so each tick re-fetches the OLDEST un-acked page from the
 * start. A skipped / dry-run / ack-failed review therefore always re-lists on
 * the next tick instead of being stranded behind an advanced watermark.
 *
 * In-memory by design: a restart re-reads from the durable ledger (acked
 * reviews never reappear in the pending feed) so nothing is double-sent.
 */
export type BridgeState = {
  processed: Set<string>;
};

export function createBridgeState(): BridgeState {
  return { processed: new Set() };
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
 * configured Coworking key (one per workspace): drain ALL pages of pending
 * approved reviews, oldest first, and for each owed item record a positive
 * ERC-8004 signal for the assignee's agentId.
 *
 * No cross-tick cursor is kept. Each tick starts from the OLDEST un-acked page
 * (no `since`); the response `nextCursor` is used ONLY as an ephemeral local
 * variable to walk subsequent pages WITHIN this tick until a page comes back
 * empty. Because /v1/reputation/pending is an authoritative server set-minus
 * (acked reviews are excluded by the ledger anti-join), this guarantees no
 * approved review is ever permanently skipped:
 *   - Normal operation is exactly-once: the server ledger drops an item the
 *     instant its ack lands, so it never re-lists.
 *   - The only at-least-once window is send-succeeded-but-ack-failed THEN a
 *     process restart (which clears the in-memory `processed` Set): the item
 *     re-lists and gets a second, benign +1. No restart => the Set dedups it.
 *
 * Dry-run (REPUTATION_BRIDGE_DRY_RUN, default TRUE, INDEPENDENT of the keeper's
 * DRY_RUN): log the intended giveFeedback, send nothing, ack nothing - so the
 * same items re-list next tick. Going live is an explicit env flip.
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
    const workspace = String(i);

    // Within-tick pagination ONLY: start with no `since` (oldest un-acked page)
    // and advance via the response cursor until a page comes back empty. This
    // cursor is a local of this tick - never persisted across ticks - so an
    // un-acked review always re-lists from the start on the next pass.
    let since: string | undefined;
    for (let pageNum = 0; pageNum < MAX_PAGES_PER_TICK; pageNum++) {
      let page;
      try {
        page = await deps.listPending(baseUrl, key, { since, limit: PAGE_LIMIT });
      } catch (err) {
        summary.failed++;
        log('bridge.fetch-error', { workspace, since, error: errorMessage(err) });
        break;
      }
      if (page.items.length === 0) break;
      summary.fetched += page.items.length;

      for (const item of page.items) {
        // In-memory dedup: a duplicate inside this run, before the server-side
        // ack is observable in a later pending page.
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
        // the id does not exist; skip + log, do NOT ack (the review stays owed
        // and re-lists next tick since no cursor advances past it).
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
          // Observational only: no send, no ack. The item re-lists next tick
          // until an operator flips REPUTATION_BRIDGE_DRY_RUN.
          summary.skipped++;
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

        const ackBody: AckReputationBody = {
          reviewId: item.reviewId,
          txHash: tx,
          agentId: item.agentId,
        };
        try {
          await deps.ack(baseUrl, key, ackBody);
        } catch (err) {
          // The signal landed on-chain but the ack failed. Mark it processed in
          // memory so this run does not re-send. With no persisted cursor it
          // will re-list (and get a benign duplicate +1) only after a restart
          // clears this Set; the operator can also re-ack out of band.
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
        summary.attested++;
        log('bridge.attested', {
          reviewId: item.reviewId,
          agentId: item.agentId,
          tag2,
          tx,
        });
      }

      // Walk to the next page within this tick. A null cursor (or one that does
      // not advance) means there is nothing more to drain right now.
      if (!page.nextCursor || page.nextCursor === since) break;
      since = page.nextCursor;
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
