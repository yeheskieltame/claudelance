import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { keccak256, toBytes } from 'viem';

import {
  createBridgeState,
  runReputationBridgeTick,
  type BridgeDeps,
} from './reputation-bridge.js';
import type { RelayerConfig } from './config.js';
import type { PendingReputationItem } from './coworking.js';

const OWNER = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca' as const;

function item(over: Partial<PendingReputationItem> = {}): PendingReputationItem {
  return {
    reviewId: 'rev-1',
    taskId: 'task-1',
    taskNumber: 1,
    taskType: 'code',
    projectId: 'proj-1',
    linkedBountyId: null,
    agentId: '42',
    assigneeMemberId: 'mem-1',
    reviewedAt: '2026-06-18T00:00:00.000Z',
    score: 5,
    ...over,
  };
}

/**
 * In-memory bridge doubles (mirrors keeper.test.ts fakeChain). The coworking
 * fake faithfully models the server-side set-minus that backs
 * GET /v1/reputation/pending: it serves the configured reviews MINUS anything
 * already acked, filtered by the `since` cursor (reviewedAt strictly greater),
 * ordered oldest-first, sliced to `limit`. This is what makes "an un-acked
 * review re-lists" and "an acked review does NOT re-list" testable without a
 * real DB. `owners` maps agentId -> NFT owner (absent = the id does not
 * resolve). `balanceWei` defaults above the 0.3 CELO floor.
 */
function fakeDeps(opts: {
  /** The full set of reviews the server knows about (the un-acked universe). */
  reviews: PendingReputationItem[];
  owners?: Record<string, string>;
  balanceWei?: bigint;
  giveFeedbackThrows?: boolean;
  ackThrows?: boolean;
}) {
  const fed: Array<{
    agentId: bigint;
    tag1: string;
    tag2: string;
    feedbackURI: string;
    feedbackHash: `0x${string}`;
  }> = [];
  const acked = new Set<string>();
  const ackLog: Array<{ reviewId: string; txHash?: string; agentId: string }> = [];
  const fetched: Array<{ since?: string; limit?: number }> = [];

  const chain: BridgeDeps['chain'] = {
    relayerAddress: '0xrelayer',
    async relayerBalance() {
      return opts.balanceWei ?? 10n ** 18n;
    },
    async identityOwnerOf(agentId: bigint) {
      const owner = (opts.owners ?? { '42': OWNER })[agentId.toString()];
      return (owner as `0x${string}` | undefined) ?? null;
    },
    async giveFeedback(
      agentId: bigint,
      feedback: { tag1: string; tag2: string; feedbackURI: string },
    ) {
      if (opts.giveFeedbackThrows) throw new Error('send failed');
      // Mirror chain.ts: the real giveFeedback binds the signal to the review by
      // hashing the feedbackURI. Capture the derived hash so tests can assert it.
      const feedbackHash = keccak256(toBytes(feedback.feedbackURI));
      fed.push({ agentId, ...feedback, feedbackHash });
      return `0xfeed${agentId}` as `0x${string}`;
    },
  };

  const listPending: BridgeDeps['listPending'] = async (
    _baseUrl: string,
    _key: string,
    o: { since?: string; limit?: number } = {},
  ) => {
    fetched.push(o);
    const since = o.since;
    const limit = o.limit ?? 100;
    const visible = opts.reviews
      .filter((r) => !acked.has(r.reviewId))
      .filter((r) => (since === undefined ? true : r.reviewedAt > since))
      .sort((a, b) =>
        a.reviewedAt === b.reviewedAt
          ? a.reviewId.localeCompare(b.reviewId)
          : a.reviewedAt.localeCompare(b.reviewedAt),
      );
    const items = visible.slice(0, limit);
    return { items, nextCursor: items.length ? items[items.length - 1]!.reviewedAt : null };
  };

  const ack: BridgeDeps['ack'] = async (_baseUrl, _key, body) => {
    if (opts.ackThrows) throw new Error('ack failed');
    acked.add(body.reviewId);
    ackLog.push(body);
  };

  return { deps: { chain, listPending, ack } as BridgeDeps, fed, acked, ackLog, fetched };
}

function makeCfg(over: Partial<RelayerConfig> = {}): RelayerConfig {
  return {
    coworkingApiUrl: 'http://coworking.local',
    coworkingApiKeys: ['key-ws1'],
    reputationBridgeEnabled: true,
    reputationBridgeDryRun: false,
    reputationBridgeIntervalMs: 300_000,
    ...over,
  } as unknown as RelayerConfig;
}

const silent = () => {};

describe('runReputationBridgeTick', () => {
  it('live path attests each owed review once and acks with the tx hash', async () => {
    const { deps, fed, ackLog } = fakeDeps({
      reviews: [
        item({ reviewId: 'rev-1', agentId: '42', reviewedAt: '2026-06-18T00:00:00.000Z' }),
        item({ reviewId: 'rev-2', agentId: '42', reviewedAt: '2026-06-18T00:01:00.000Z' }),
      ],
    });
    const state = createBridgeState();
    const summary = await runReputationBridgeTick(deps, makeCfg(), state, silent);

    assert.equal(summary.attested, 2);
    assert.equal(summary.failed, 0);
    assert.deepEqual(
      fed.map((f) => [f.agentId, f.tag1, f.tag2, f.feedbackURI]),
      [
        [42n, 'claudelance-coworking', '0', 'claudelance-coworking://task/task-1'],
        [42n, 'claudelance-coworking', '0', 'claudelance-coworking://task/task-1'],
      ],
    );
    assert.deepEqual(
      ackLog.map((a) => [a.reviewId, a.txHash, a.agentId]),
      [
        ['rev-1', '0xfeed42', '42'],
        ['rev-2', '0xfeed42', '42'],
      ],
    );
    assert.equal(state.processed.has('rev-1'), true);
    assert.equal(state.processed.has('rev-2'), true);
  });

  it('binds a non-zero feedbackHash derived from the feedbackURI', async () => {
    const { deps, fed } = fakeDeps({ reviews: [item({ reviewId: 'rev-1', taskId: 'task-7' })] });
    await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);

    assert.equal(fed.length, 1);
    const sent = fed[0]!;
    const expected = keccak256(toBytes('claudelance-coworking://task/task-7'));
    assert.equal(sent.feedbackURI, 'claudelance-coworking://task/task-7');
    assert.equal(sent.feedbackHash, expected);
    // Provenance: not the all-zero placeholder.
    assert.notEqual(sent.feedbackHash, `0x${'0'.repeat(64)}`);
  });

  it('maps the task type to the bounty-type tag2 (custom default for PM types)', async () => {
    const { deps, fed } = fakeDeps({
      reviews: [
        item({ reviewId: 'r-research', taskType: 'research', reviewedAt: '2026-06-18T00:00:00.000Z' }),
        item({ reviewId: 'r-generic', taskType: 'generic', reviewedAt: '2026-06-18T00:01:00.000Z' }),
      ],
    });
    await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);
    assert.deepEqual(
      fed.map((f) => f.tag2),
      ['2', '10'],
    );
  });

  it('skips a review whose agentId does not resolve to an Identity NFT (no ack)', async () => {
    const { deps, fed, acked } = fakeDeps({
      reviews: [item({ reviewId: 'rev-1', agentId: '999' })],
      owners: {}, // 999 has no owner
    });
    const summary = await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);

    assert.equal(summary.skipped, 1);
    assert.equal(summary.attested, 0);
    assert.equal(fed.length, 0);
    assert.equal(acked.size, 0);
  });

  it('skips a row with a non-numeric (effectively missing) agentId', async () => {
    const { deps, fed, acked } = fakeDeps({
      reviews: [item({ reviewId: 'rev-1', agentId: '' })],
    });
    const summary = await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);

    assert.equal(summary.skipped, 1);
    assert.equal(fed.length, 0);
    assert.equal(acked.size, 0);
  });

  it('dry-run writes nothing and acks nothing', async () => {
    const { deps, fed, acked } = fakeDeps({
      reviews: [
        item({ reviewId: 'rev-1', reviewedAt: '2026-06-18T00:00:00.000Z' }),
        item({ reviewId: 'rev-2', reviewedAt: '2026-06-18T00:01:00.000Z' }),
      ],
    });
    const state = createBridgeState();
    const summary = await runReputationBridgeTick(
      deps,
      makeCfg({ reputationBridgeDryRun: true }),
      state,
      silent,
    );

    assert.equal(summary.attested, 0);
    assert.equal(fed.length, 0);
    assert.equal(acked.size, 0);
    assert.equal(state.processed.size, 0);
  });

  it('re-lists an un-acked (dry-run) review on the next tick rather than stranding it', async () => {
    // No cursor is persisted, so a review left un-acked by a dry-run tick must
    // re-appear when the bridge later runs live and attest then.
    const { deps, fed, acked } = fakeDeps({ reviews: [item({ reviewId: 'rev-1' })] });
    const state = createBridgeState();

    const dry = await runReputationBridgeTick(
      deps,
      makeCfg({ reputationBridgeDryRun: true }),
      state,
      silent,
    );
    assert.equal(dry.attested, 0);
    assert.equal(fed.length, 0);

    // Same shared state, now live: the dry-run item was NOT acked, so the
    // server set-minus still serves it and it is attested.
    const live = await runReputationBridgeTick(deps, makeCfg(), state, silent);
    assert.equal(live.attested, 1);
    assert.equal(fed.length, 1);
    assert.equal(acked.has('rev-1'), true);
  });

  it('re-lists and reprocesses an ack-failed review after a restart (fresh state)', async () => {
    // Tick 1: ack throws -> the signal lands but the review is NOT acked, and
    // the in-memory Set marks it processed so THIS run does not re-send.
    const failing = fakeDeps({ reviews: [item({ reviewId: 'rev-1' })], ackThrows: true });
    const state1 = createBridgeState();
    const t1 = await runReputationBridgeTick(failing.deps, makeCfg(), state1, silent);
    assert.equal(failing.fed.length, 1); // landed on-chain
    assert.equal(failing.acked.has('rev-1'), false); // ack failed -> still owed
    assert.equal(t1.failed, 1);
    assert.equal(t1.attested, 0);

    // Same process, same Set: the item is deduped, NOT re-sent.
    const t1b = await runReputationBridgeTick(failing.deps, makeCfg(), state1, silent);
    assert.equal(failing.fed.length, 1);
    assert.equal(t1b.skipped, 1);

    // Restart clears the in-memory Set; the still-un-acked review re-lists and
    // is reprocessed (a benign duplicate +1). This is the at-least-once window.
    const restarted = fakeDeps({ reviews: [item({ reviewId: 'rev-1' })] });
    const state2 = createBridgeState();
    const t2 = await runReputationBridgeTick(restarted.deps, makeCfg(), state2, silent);
    assert.equal(restarted.fed.length, 1);
    assert.equal(t2.attested, 1);
    assert.equal(restarted.acked.has('rev-1'), true);
  });

  it('does NOT re-list an acked review on a later tick (server set-minus)', async () => {
    const { deps, fed, fetched } = fakeDeps({ reviews: [item({ reviewId: 'rev-1' })] });
    const state = createBridgeState();

    const first = await runReputationBridgeTick(deps, makeCfg(), state, silent);
    assert.equal(first.attested, 1);
    assert.equal(fed.length, 1);
    // Every tick re-fetches from the start: the first poll carries no `since`
    // (within-tick pagination may then advance a cursor on follow-up pages).
    assert.equal(fetched[0]!.since, undefined);

    // Fresh state simulates a restart: even so, the acked review is gone from
    // the server feed, so nothing is fetched-as-work or re-sent.
    const fetchesBefore = fetched.length;
    const second = await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);
    assert.equal(second.attested, 0);
    assert.equal(second.fetched, 0);
    assert.equal(fed.length, 1);
    // Tick 2 polled exactly once, from the start, and got an empty feed.
    const secondTickFetches = fetched.slice(fetchesBefore);
    assert.equal(secondTickFetches.length, 1);
    assert.equal(secondTickFetches[0]!.since, undefined);
  });

  it('in-memory Set prevents a re-send when the same reviewId is served twice in one run', async () => {
    // ackThrows keeps the review in the server feed (un-acked) so it would
    // re-list; the in-memory Set must still guard against a duplicate send.
    const { deps, fed } = fakeDeps({ reviews: [item({ reviewId: 'rev-1' })], ackThrows: true });
    const state = createBridgeState();
    await runReputationBridgeTick(deps, makeCfg(), state, silent);
    const second = await runReputationBridgeTick(deps, makeCfg(), state, silent);

    assert.equal(fed.length, 1); // attested only on the first tick
    assert.equal(second.attested, 0);
    assert.equal(second.skipped, 1);
  });

  it('skips the whole tick below the keeper balance floor', async () => {
    const { deps, fed, acked, fetched } = fakeDeps({
      reviews: [item()],
      balanceWei: 100_000_000_000_000_000n, // 0.1 CELO < 0.3 floor
    });
    const summary = await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);

    assert.equal(summary.fetched, 0);
    assert.equal(fetched.length, 0); // never even polled coworking
    assert.equal(fed.length, 0);
    assert.equal(acked.size, 0);
  });

  it('records the on-chain send but counts a failure when the ack call fails', async () => {
    const { deps, fed, acked } = fakeDeps({
      reviews: [item({ reviewId: 'rev-1' })],
      ackThrows: true,
    });
    const state = createBridgeState();
    const summary = await runReputationBridgeTick(deps, makeCfg(), state, silent);

    assert.equal(fed.length, 1); // the signal landed on-chain
    assert.equal(acked.size, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.attested, 0);
    // Marked processed so this run does not re-send.
    assert.equal(state.processed.has('rev-1'), true);
  });

  it('drains multiple pages within one tick via the response cursor', async () => {
    // limit is fixed at 100 in the bridge; use distinct timestamps so the
    // server cursor walks forward across more than one page of work.
    const reviews = Array.from({ length: 150 }, (_, i) =>
      item({
        reviewId: `rev-${String(i).padStart(3, '0')}`,
        reviewedAt: `2026-06-18T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`,
      }),
    );
    const { deps, fed, acked, fetched } = fakeDeps({ reviews });
    const summary = await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);

    assert.equal(summary.attested, 150);
    assert.equal(fed.length, 150);
    assert.equal(acked.size, 150);
    // First page with no `since`, subsequent pages carry a cursor.
    assert.equal(fetched[0]!.since, undefined);
    assert.ok(fetched.length >= 2);
  });

  it('iterates every configured workspace key', async () => {
    const { deps, fed } = fakeDeps({
      reviews: [item({ reviewId: 'r1' })],
    });
    const summary = await runReputationBridgeTick(
      deps,
      makeCfg({ coworkingApiKeys: ['key-ws1', 'key-ws2'] }),
      createBridgeState(),
      silent,
    );

    // The fake serves the same set for both keys (acks are shared), so the
    // first key drains it and the second sees an empty feed - exercising the
    // per-key loop without double-counting.
    assert.equal(summary.attested, 1);
    assert.equal(fed.length, 1);
  });
});
