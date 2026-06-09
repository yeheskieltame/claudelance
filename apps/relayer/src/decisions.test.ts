import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BountyStatus } from '@yeheskieltame/claudelance-sdk';

import {
  GRACE_PERIOD_SECONDS,
  ciPassedFromConclusion,
  decideAttest,
  decideKeeperActions,
  deliverableMatchesCi,
  normalizeDeliverableUrl,
  padCommitHash,
  shouldReattest,
} from './decisions.js';

const WORKER_A = '0x1111111111111111111111111111111111111111' as const;
const WORKER_B = '0x2222222222222222222222222222222222222222' as const;
const ZERO = '0x0000000000000000000000000000000000000000' as const;

test('open bounty inside its window needs no action', () => {
  const actions = decideKeeperActions(
    1n,
    { status: BountyStatus.Open, deadline: 10_000n, stakeRequired: 1n, winner: ZERO },
    [],
    5_000n,
    false,
  );
  assert.deepEqual(actions, []);
});

test('open bounty past deadline+grace is cancellable by anyone', () => {
  const deadline = 10_000n;
  const actions = decideKeeperActions(
    7n,
    { status: BountyStatus.Open, deadline, stakeRequired: 1n, winner: ZERO },
    [],
    deadline + GRACE_PERIOD_SECONDS,
    false,
  );
  assert.deepEqual(actions, [{ kind: 'cancelExpired', bountyId: 7n }]);
});

test('open bounty inside the grace window is left to the poster', () => {
  const deadline = 10_000n;
  const actions = decideKeeperActions(
    7n,
    { status: BountyStatus.Open, deadline, stakeRequired: 1n, winner: ZERO },
    [],
    deadline + GRACE_PERIOD_SECONDS - 1n,
    false,
  );
  assert.deepEqual(actions, []);
});

test('resolved bounty settles only unsettled stakes', () => {
  const actions = decideKeeperActions(
    3n,
    { status: BountyStatus.Resolved, deadline: 1n, stakeRequired: 100n, winner: WORKER_A },
    [
      { worker: WORKER_A, stakeSettled: true },
      { worker: WORKER_B, stakeSettled: false },
    ],
    9_999n,
    true,
  );
  assert.deepEqual(actions, [{ kind: 'settleStake', bountyId: 3n, worker: WORKER_B }]);
});

test('cancelled bounty also sweeps locked stakes', () => {
  const actions = decideKeeperActions(
    4n,
    { status: BountyStatus.Cancelled, deadline: 1n, stakeRequired: 100n, winner: ZERO },
    [{ worker: WORKER_A, stakeSettled: false }],
    9_999n,
    false,
  );
  assert.deepEqual(actions, [{ kind: 'settleStake', bountyId: 4n, worker: WORKER_A }]);
});

test('zero-stake resolved bounty produces no settle calls', () => {
  const actions = decideKeeperActions(
    5n,
    { status: BountyStatus.Resolved, deadline: 1n, stakeRequired: 0n, winner: WORKER_A },
    [{ worker: WORKER_A, stakeSettled: false }],
    9_999n,
    true,
  );
  assert.deepEqual(actions, []);
});

test('resolved unattested bounty queues an attest for the winner', () => {
  const actions = decideKeeperActions(
    6n,
    { status: BountyStatus.Resolved, deadline: 1n, stakeRequired: 0n, winner: WORKER_A },
    [{ worker: WORKER_A, stakeSettled: true }],
    9_999n,
    false,
  );
  assert.deepEqual(actions, [{ kind: 'attestReputation', bountyId: 6n, winner: WORKER_A }]);
});

test('resolved unattested bounty with locked stakes settles then attests', () => {
  const actions = decideKeeperActions(
    6n,
    { status: BountyStatus.Resolved, deadline: 1n, stakeRequired: 100n, winner: WORKER_A },
    [{ worker: WORKER_B, stakeSettled: false }],
    9_999n,
    false,
  );
  assert.deepEqual(actions, [
    { kind: 'settleStake', bountyId: 6n, worker: WORKER_B },
    { kind: 'attestReputation', bountyId: 6n, winner: WORKER_A },
  ]);
});

test('already-attested resolved bounty queues no attest', () => {
  const actions = decideKeeperActions(
    6n,
    { status: BountyStatus.Resolved, deadline: 1n, stakeRequired: 0n, winner: WORKER_A },
    [],
    9_999n,
    true,
  );
  assert.deepEqual(actions, []);
});

test('cancelled bounty never attests', () => {
  const actions = decideKeeperActions(
    6n,
    { status: BountyStatus.Cancelled, deadline: 1n, stakeRequired: 0n, winner: ZERO },
    [],
    9_999n,
    false,
  );
  assert.deepEqual(actions, []);
});

test('ciPassedFromConclusion maps verdicts', () => {
  assert.equal(ciPassedFromConclusion('success'), true);
  assert.equal(ciPassedFromConclusion('failure'), false);
  assert.equal(ciPassedFromConclusion('timed_out'), false);
  assert.equal(ciPassedFromConclusion('cancelled'), null);
  assert.equal(ciPassedFromConclusion(null), null);
});

test('decideAttest only attests an open, CI-required bounty with a verdict', () => {
  const base = { bountyId: 2n, worker: WORKER_A } as const;

  assert.deepEqual(
    decideAttest('success', { ...base, bountyStatus: BountyStatus.Open, ciRequired: true }),
    { kind: 'attestCI', bountyId: 2n, worker: WORKER_A, passed: true },
  );
  assert.equal(
    decideAttest('success', { ...base, bountyStatus: BountyStatus.Resolved, ciRequired: true }),
    null,
  );
  assert.equal(
    decideAttest('success', { ...base, bountyStatus: BountyStatus.Open, ciRequired: false }),
    null,
  );
  assert.equal(
    decideAttest(null, { ...base, bountyStatus: BountyStatus.Open, ciRequired: true }),
    null,
  );
});

test('decideAttest skips a task type whose config disables CI', () => {
  const ctx = {
    bountyId: 2n,
    worker: WORKER_A,
    bountyStatus: BountyStatus.Open,
    ciRequired: true,
    ciSupported: false,
  } as const;
  assert.equal(decideAttest('success', ctx), null);
});

test('padCommitHash right-pads a 40-char sha to bytes32', () => {
  const sha = 'a'.repeat(40);
  assert.equal(padCommitHash(sha), `0x${'a'.repeat(40)}${'0'.repeat(24)}`);
});

test('normalizeDeliverableUrl lowercases and drops trailing slashes', () => {
  assert.equal(
    normalizeDeliverableUrl('https://GitHub.com/Owner/Repo/pull/12/'),
    'https://github.com/owner/repo/pull/12',
  );
});

test('deliverableMatchesCi matches on the PR url first', () => {
  const url = 'https://github.com/yeheskieltame/claudelance/pull/389';
  const ref = { deliverableUrl: url, deliverableHash: `0x${'9'.repeat(64)}` };
  assert.equal(deliverableMatchesCi(ref, [url], 'feedface'), true);
  assert.equal(deliverableMatchesCi(ref, ['https://github.com/x/y/pull/1'], 'feedface'), false);
});

test('deliverableMatchesCi falls back to a padded commit sha', () => {
  const sha = 'b'.repeat(40);
  const ref = { deliverableUrl: '', deliverableHash: padCommitHash(sha) };
  assert.equal(deliverableMatchesCi(ref, [], sha), true);
  assert.equal(deliverableMatchesCi(ref, [], 'c'.repeat(40)), false);
});

test('shouldReattest flags only a changed verdict', () => {
  assert.equal(shouldReattest({ ciPassed: false }, true), true);
  assert.equal(shouldReattest({ ciPassed: true }, true), false);
});
