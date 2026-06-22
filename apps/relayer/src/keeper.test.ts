import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { BountyStatus, ZERO_ADDRESS } from '@yeheskieltame/claudelance-sdk';

import { createKeeperState, runKeeperTick, type KeeperState } from './keeper.js';
import type { ChainClient } from './chain.js';
import type { RelayerConfig } from './config.js';

const W1 = '0x1111111111111111111111111111111111111111' as const;
const W2 = '0x2222222222222222222222222222222222222222' as const;
const POSTER = '0x9999999999999999999999999999999999999999' as const;

const FUTURE = BigInt(Math.floor(Date.now() / 1000)) + 86_400n;

type FakeBounty = {
  poster: string;
  status: BountyStatus;
  deadline: bigint;
  stakeRequired: bigint;
  winner: string;
};

function bounty(over: Partial<FakeBounty> = {}): FakeBounty {
  return {
    poster: POSTER,
    status: BountyStatus.Resolved,
    deadline: FUTURE,
    stakeRequired: 50n,
    winner: W1,
    ...over,
  };
}

const EMPTY = bounty({ poster: ZERO_ADDRESS });

/**
 * Minimal in-memory ChainClient double. Bounty ids are 1-based indexes into
 * `bounties`; everything past the array end reads as the empty struct.
 */
function fakeChain(opts: {
  bounties: FakeBounty[];
  claimers?: Record<string, string[]>;
  settled?: Record<string, boolean>;
  attested?: Record<string, boolean>;
  agentIds?: Record<string, bigint>;
}) {
  const sent: Array<{ kind: string; bountyId: bigint; nonce?: number }> = [];
  const calls = { ranges: 0, claimerBatches: 0, submissionBatches: 0, attestBatches: 0 };
  const chain = {
    sent,
    calls,
    relayerAddress: '0xrelayer',
    async relayerBalance() {
      return 10n ** 18n;
    },
    async getBountiesRange(startId: bigint, count: number) {
      calls.ranges++;
      return Array.from({ length: count }, (_, i) => {
        const idx = Number(startId) + i - 1;
        return opts.bounties[idx] ?? EMPTY;
      });
    },
    async getClaimersBatch(ids: bigint[]) {
      calls.claimerBatches++;
      return ids.map((id) => opts.claimers?.[id.toString()] ?? []);
    },
    async getSubmissionsBatch(pairs: Array<{ bountyId: bigint; worker: string }>) {
      calls.submissionBatches++;
      return pairs.map((p) => ({
        stakeSettled: opts.settled?.[`${p.bountyId}:${p.worker}`] ?? false,
        ciPassed: true,
      }));
    },
    async isReputationAttestedBatch(ids: bigint[]) {
      calls.attestBatches++;
      return ids.map((id) => opts.attested?.[id.toString()] ?? false);
    },
    async gasPrice() {
      return 1_000n;
    },
    async pendingNonce() {
      return 7;
    },
    async settleStake(bountyId: bigint, _worker: string, o: { nonce?: number } = {}) {
      sent.push({ kind: 'settleStake', bountyId, nonce: o.nonce });
      return `0xsettle${bountyId}` as `0x${string}`;
    },
    async cancelExpired(bountyId: bigint, o: { nonce?: number } = {}) {
      sent.push({ kind: 'cancelExpired', bountyId, nonce: o.nonce });
      return `0xcancel${bountyId}` as `0x${string}`;
    },
    async attestReputation(bountyId: bigint, _agentId: bigint, o: { nonce?: number } = {}) {
      sent.push({ kind: 'attestReputation', bountyId, nonce: o.nonce });
      return `0xattest${bountyId}` as `0x${string}`;
    },
    async waitForReceipt() {
      return 'success' as const;
    },
    async findAgentIdByOwner(worker: string) {
      return opts.agentIds?.[worker.toLowerCase()] ?? null;
    },
    async identityOwnerOf(agentId: bigint) {
      const entry = Object.entries(opts.agentIds ?? {}).find(([, id]) => id === agentId);
      return entry ? entry[0] : null;
    },
  };
  return chain as unknown as ChainClient & { sent: typeof sent; calls: typeof calls };
}

const cfg = {
  dryRun: false,
  identityEventsFromBlock: 0n,
  keeperMinBalanceWei: 600_000_000_000_000_000n, // 0.6 CELO; fake chain reports 1 CELO so no alert
} as unknown as RelayerConfig;

const silent = () => {};

describe('runKeeperTick (watermark scan)', () => {
  it('advances the watermark over fully closed bounties and stops at live ones', async () => {
    const chain = fakeChain({
      bounties: [
        bounty({ status: BountyStatus.Resolved }), // 1: done
        bounty({ status: BountyStatus.Cancelled }), // 2: done
        bounty({ status: BountyStatus.Open }), // 3: live, inside window
        bounty({ status: BountyStatus.Resolved }), // 4: done but above live id
      ],
      claimers: { '1': [W1], '2': [W1], '4': [W2] },
      settled: { [`1:${W1}`]: true, [`2:${W1}`]: true, [`4:${W2}`]: true },
      attested: { '1': true, '4': true },
    });
    const state = createKeeperState();
    const summary = await runKeeperTick(chain, cfg, silent, state);

    assert.equal(summary.scanned, 4);
    assert.equal(summary.actions, 0);
    assert.equal(state.watermark, 2n); // blocked by the open bounty at id 3
    assert.equal(chain.sent.length, 0);
  });

  it('next tick scans only above the watermark', async () => {
    const chain = fakeChain({
      bounties: [
        bounty(),
        bounty(),
        bounty(),
      ],
      claimers: { '1': [W1], '2': [W1], '3': [W1] },
      settled: { [`1:${W1}`]: true, [`2:${W1}`]: true, [`3:${W1}`]: true },
      attested: { '1': true, '2': true, '3': true },
    });
    const state = createKeeperState();
    await runKeeperTick(chain, cfg, silent, state);
    assert.equal(state.watermark, 3n);

    const second = await runKeeperTick(chain, cfg, silent, state);
    assert.equal(second.scanned, 0);
  });

  it('plans settles and attests, sends them on sequential nonces', async () => {
    const chain = fakeChain({
      bounties: [
        bounty(), // 1: needs settle for both claimers + attest
      ],
      claimers: { '1': [W1, W2] },
      settled: {},
      attested: {},
      agentIds: { [W1.toLowerCase()]: 42n },
    });
    const state = createKeeperState();
    const summary = await runKeeperTick(chain, cfg, silent, state);

    assert.equal(summary.actions, 3);
    assert.equal(summary.executed, 3);
    assert.deepEqual(
      chain.sent.map((s) => [s.kind, s.nonce]),
      [
        ['settleStake', 7],
        ['settleStake', 8],
        ['attestReputation', 9],
      ],
    );
    // Not done yet this tick: watermark waits for confirmation next pass.
    assert.equal(state.watermark, 0n);
  });

  it('skips attest (not settle) when the winner has no resolvable agent id', async () => {
    const chain = fakeChain({
      bounties: [bounty()],
      claimers: { '1': [W1] },
      settled: {},
      attested: {},
      agentIds: {},
    });
    const summary = await runKeeperTick(chain, cfg, silent, createKeeperState());

    assert.equal(summary.skipped, 1);
    assert.deepEqual(
      chain.sent.map((s) => s.kind),
      ['settleStake'],
    );
  });

  it('cancels an expired open bounty past the grace period', async () => {
    const past = BigInt(Math.floor(Date.now() / 1000)) - 4n * 86_400n;
    const chain = fakeChain({
      bounties: [bounty({ status: BountyStatus.Open, deadline: past })],
    });
    const summary = await runKeeperTick(chain, cfg, silent, createKeeperState());

    assert.equal(summary.actions, 1);
    assert.deepEqual(
      chain.sent.map((s) => s.kind),
      ['cancelExpired'],
    );
  });

  it('uses one batch call per kind regardless of backlog size', async () => {
    const bounties = Array.from({ length: 40 }, () => bounty());
    const claimers: Record<string, string[]> = {};
    const settled: Record<string, boolean> = {};
    const attested: Record<string, boolean> = {};
    for (let i = 1; i <= 40; i++) {
      claimers[String(i)] = [W1];
      settled[`${i}:${W1}`] = true;
      attested[String(i)] = true;
    }
    const chain = fakeChain({ bounties, claimers, settled, attested });
    const state = createKeeperState();
    await runKeeperTick(chain, cfg, silent, state);

    assert.equal(chain.calls.claimerBatches, 1);
    assert.equal(chain.calls.submissionBatches, 1);
    assert.equal(chain.calls.attestBatches, 1);
    assert.equal(state.watermark, 40n);
  });

  it('dry run plans but never sends', async () => {
    const chain = fakeChain({
      bounties: [bounty()],
      claimers: { '1': [W1] },
      agentIds: { [W1.toLowerCase()]: 42n },
    });
    const dryCfg = { ...cfg, dryRun: true } as RelayerConfig;
    const summary = await runKeeperTick(chain, dryCfg, silent, createKeeperState());

    assert.equal(summary.actions, 2);
    assert.equal(chain.sent.length, 0);
  });
});

describe('KeeperState', () => {
  it('starts at watermark zero with an empty cache', () => {
    const state: KeeperState = createKeeperState();
    assert.equal(state.watermark, 0n);
    assert.equal(state.cache.byWorker.size, 0);
  });
});
