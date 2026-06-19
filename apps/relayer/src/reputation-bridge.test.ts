import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

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
 * In-memory bridge doubles (mirrors keeper.test.ts fakeChain): a fake coworking
 * client that serves canned pages and records acks, plus a fake ChainClient
 * recording every giveFeedback. `owners` maps agentId -> NFT owner (absent = the
 * id does not resolve). `balanceWei` defaults above the 0.3 CELO floor.
 */
function fakeDeps(opts: {
  pages: PendingReputationItem[][];
  owners?: Record<string, string>;
  balanceWei?: bigint;
  giveFeedbackThrows?: boolean;
  ackThrows?: boolean;
}) {
  const fed: Array<{ agentId: bigint; tag1: string; tag2: string; feedbackURI: string }> = [];
  const acked: Array<{ reviewId: string; txHash?: string; agentId: string }> = [];
  const fetched: Array<{ since?: string; limit?: number }> = [];
  let pageIdx = 0;

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
      fed.push({ agentId, ...feedback });
      return `0xfeed${agentId}` as `0x${string}`;
    },
  };

  const listPending: BridgeDeps['listPending'] = async (
    _baseUrl: string,
    _key: string,
    o: { since?: string; limit?: number } = {},
  ) => {
    fetched.push(o);
    const items = opts.pages[pageIdx] ?? [];
    pageIdx++;
    return { items, nextCursor: items.length ? items[items.length - 1]!.reviewedAt : null };
  };

  const ack: BridgeDeps['ack'] = async (_baseUrl, _key, body) => {
    if (opts.ackThrows) throw new Error('ack failed');
    acked.push(body);
  };

  return { deps: { chain, listPending, ack } as BridgeDeps, fed, acked, fetched };
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
    const { deps, fed, acked } = fakeDeps({
      pages: [[item({ reviewId: 'rev-1', agentId: '42' }), item({ reviewId: 'rev-2', agentId: '42' })]],
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
      acked.map((a) => [a.reviewId, a.txHash, a.agentId]),
      [
        ['rev-1', '0xfeed42', '42'],
        ['rev-2', '0xfeed42', '42'],
      ],
    );
    // Cursor advanced to the last acked review's timestamp.
    assert.equal(state.cursors.get('0'), '2026-06-18T00:00:00.000Z');
    assert.equal(state.processed.has('rev-1'), true);
    assert.equal(state.processed.has('rev-2'), true);
  });

  it('maps the task type to the bounty-type tag2 (custom default for PM types)', async () => {
    const { deps, fed } = fakeDeps({
      pages: [
        [
          item({ reviewId: 'r-research', taskType: 'research' }),
          item({ reviewId: 'r-generic', taskType: 'generic' }),
        ],
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
      pages: [[item({ reviewId: 'rev-1', agentId: '999' })]],
      owners: {}, // 999 has no owner
    });
    const state = createBridgeState();
    const summary = await runReputationBridgeTick(deps, makeCfg(), state, silent);

    assert.equal(summary.skipped, 1);
    assert.equal(summary.attested, 0);
    assert.equal(fed.length, 0);
    assert.equal(acked.length, 0);
    // Not acked => cursor stays put so the item is retried.
    assert.equal(state.cursors.has('0'), false);
  });

  it('skips a row with a non-numeric (effectively missing) agentId', async () => {
    const { deps, fed, acked } = fakeDeps({
      pages: [[item({ reviewId: 'rev-1', agentId: '' })]],
    });
    const summary = await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);

    assert.equal(summary.skipped, 1);
    assert.equal(fed.length, 0);
    assert.equal(acked.length, 0);
  });

  it('dry-run writes nothing, acks nothing, and does not advance the cursor', async () => {
    const { deps, fed, acked } = fakeDeps({
      pages: [[item({ reviewId: 'rev-1' }), item({ reviewId: 'rev-2' })]],
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
    assert.equal(acked.length, 0);
    assert.equal(state.cursors.has('0'), false);
    assert.equal(state.processed.size, 0);
  });

  it('Layer-2 Set prevents a re-send when the same reviewId reappears in a page', async () => {
    // Same reviewId served twice across two ticks sharing one state. The server
    // ack would normally drop it, but the in-memory Set guards even before that.
    const { deps, fed, acked } = fakeDeps({
      pages: [[item({ reviewId: 'rev-1' })], [item({ reviewId: 'rev-1' })]],
    });
    const state = createBridgeState();
    await runReputationBridgeTick(deps, makeCfg(), state, silent);
    const second = await runReputationBridgeTick(deps, makeCfg(), state, silent);

    assert.equal(fed.length, 1); // attested only on the first tick
    assert.equal(acked.length, 1);
    assert.equal(second.attested, 0);
    assert.equal(second.skipped, 1);
  });

  it('skips the whole tick below the keeper balance floor', async () => {
    const { deps, fed, acked, fetched } = fakeDeps({
      pages: [[item()]],
      balanceWei: 100_000_000_000_000_000n, // 0.1 CELO < 0.3 floor
    });
    const summary = await runReputationBridgeTick(deps, makeCfg(), createBridgeState(), silent);

    assert.equal(summary.fetched, 0);
    assert.equal(fetched.length, 0); // never even polled coworking
    assert.equal(fed.length, 0);
    assert.equal(acked.length, 0);
  });

  it('records the on-chain send but counts a failure when the ack call fails', async () => {
    const { deps, fed, acked } = fakeDeps({
      pages: [[item({ reviewId: 'rev-1' })]],
      ackThrows: true,
    });
    const state = createBridgeState();
    const summary = await runReputationBridgeTick(deps, makeCfg(), state, silent);

    assert.equal(fed.length, 1); // the signal landed on-chain
    assert.equal(acked.length, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.attested, 0);
    // Marked processed so this run does not re-send; cursor NOT advanced.
    assert.equal(state.processed.has('rev-1'), true);
    assert.equal(state.cursors.has('0'), false);
  });

  it('iterates every configured workspace key with its own cursor', async () => {
    const { deps, fed, fetched } = fakeDeps({
      pages: [[item({ reviewId: 'ws1-r1' })], [item({ reviewId: 'ws2-r1' })]],
    });
    const summary = await runReputationBridgeTick(
      deps,
      makeCfg({ coworkingApiKeys: ['key-ws1', 'key-ws2'] }),
      createBridgeState(),
      silent,
    );

    assert.equal(fetched.length, 2); // one poll per key
    assert.equal(fed.length, 2);
    assert.equal(summary.attested, 2);
  });
});
