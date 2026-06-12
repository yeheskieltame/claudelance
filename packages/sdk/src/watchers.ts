/**
 * Real-time event subscriptions for ClaudelanceCoreV3.
 *
 * Each watcher uses viem's `watchContractEvent` under the hood and returns
 * an `unwatch` function that stops the subscription when called - same
 * pattern as viem's own watch helpers.
 *
 * Works in both Node.js (polling) and browser (WebSocket if supported).
 * No extra dependencies - only viem (already a peer dependency).
 *
 * Usage:
 *   const unwatch = watchBountyPosted(client, {}, (evt) => console.log(evt))
 *   // later:
 *   unwatch()
 */

import {
  type PublicClient,
  type Address,
  type Log,
} from 'viem';
import { CLAUDELANCE_CORE_V3_ABI } from '@yeheskieltame/claudelance-types';

// Shared types

export type WatchOptions = {
  /** Override the default polling interval (ms). Only used in polling mode. */
  pollingInterval?: number;
  /** Block to start watching from. Defaults to 'latest'. */
  fromBlock?: bigint;
};

export type UnwatchFn = () => void;

// BountyPosted

export type BountyPostedEvent = {
  bountyId: bigint;
  poster: Address;
  token: Address;
  bountyType: number;
  amount: bigint;
  maxSlots: number;
  targetRepoUrl: string;
  requirementsHash: `0x${string}`;
  /** Raw viem log for advanced consumers. */
  log: Log;
};

export type BountyPostedFilter = WatchOptions & {
  /** Only emit events for this poster address. */
  poster?: Address;
  /** Only emit events for this token. */
  token?: Address;
};

/**
 * Subscribe to new bounties posted on the v3 contract.
 * Returns an `unwatch` function to stop the subscription.
 */
export function watchBountyPosted(
  publicClient: PublicClient,
  core: Address,
  opts: BountyPostedFilter,
  onEvent: (evt: BountyPostedEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'BountyPosted',
    args: {
      ...(opts.poster ? { poster: opts.poster } : {}),
      ...(opts.token ? { token: opts.token } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<BountyPostedEvent>;
        if (!a.bountyId) continue;
        onEvent({
          bountyId: a.bountyId,
          poster: a.poster ?? '0x',
          token: a.token ?? '0x',
          bountyType: Number(a.bountyType ?? 0),
          amount: a.amount ?? 0n,
          maxSlots: Number(a.maxSlots ?? 0),
          targetRepoUrl: a.targetRepoUrl ?? '',
          requirementsHash: (a.requirementsHash ?? `0x${'0'.repeat(64)}`) as `0x${string}`,
          log,
        });
      }
    },
  });
}

// DeliverableSubmitted

export type DeliverableSubmittedEvent = {
  bountyId: bigint;
  worker: Address;
  deliverableUrl: string;
  deliverableHash: `0x${string}`;
  log: Log;
};

export type DeliverableSubmittedFilter = WatchOptions & {
  bountyId?: bigint;
  worker?: Address;
};

/**
 * Subscribe to deliverable submissions on the v3 contract.
 * Fires for all task types (code PRs, research reports, translations, etc.).
 */
export function watchDeliverableSubmitted(
  publicClient: PublicClient,
  core: Address,
  opts: DeliverableSubmittedFilter,
  onEvent: (evt: DeliverableSubmittedEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'DeliverableSubmitted',
    args: {
      ...(opts.bountyId !== undefined ? { bountyId: opts.bountyId } : {}),
      ...(opts.worker ? { worker: opts.worker } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<DeliverableSubmittedEvent>;
        if (!a.bountyId) continue;
        onEvent({
          bountyId: a.bountyId,
          worker: a.worker ?? '0x',
          deliverableUrl: a.deliverableUrl ?? '',
          deliverableHash: (a.deliverableHash ?? `0x${'0'.repeat(64)}`) as `0x${string}`,
          log,
        });
      }
    },
  });
}

// BountyResolved

export type BountyResolvedEvent = {
  bountyId: bigint;
  winner: Address;
  token: Address;
  winnerPayout: bigint;
  protocolFee: bigint;
  log: Log;
};

export type BountyResolvedFilter = WatchOptions & {
  bountyId?: bigint;
  winner?: Address;
  token?: Address;
};

/**
 * Subscribe to bounty resolutions (pickWinner called).
 * Useful for workers to detect when they've been selected.
 */
export function watchBountyResolved(
  publicClient: PublicClient,
  core: Address,
  opts: BountyResolvedFilter,
  onEvent: (evt: BountyResolvedEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'BountyResolved',
    args: {
      ...(opts.bountyId !== undefined ? { bountyId: opts.bountyId } : {}),
      ...(opts.winner ? { winner: opts.winner } : {}),
      ...(opts.token ? { token: opts.token } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<BountyResolvedEvent>;
        if (!a.bountyId) continue;
        onEvent({
          bountyId: a.bountyId,
          winner: a.winner ?? '0x',
          token: a.token ?? '0x',
          winnerPayout: a.winnerPayout ?? 0n,
          protocolFee: a.protocolFee ?? 0n,
          log,
        });
      }
    },
  });
}

// SlotClaimed

export type SlotClaimedEvent = {
  bountyId: bigint;
  worker: Address;
  log: Log;
};

export type SlotClaimedFilter = WatchOptions & {
  bountyId?: bigint;
  worker?: Address;
};

/** Subscribe to slot claim events. Useful for monitoring bounty fill rates. */
export function watchSlotClaimed(
  publicClient: PublicClient,
  core: Address,
  opts: SlotClaimedFilter,
  onEvent: (evt: SlotClaimedEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'SlotClaimed',
    args: {
      ...(opts.bountyId !== undefined ? { bountyId: opts.bountyId } : {}),
      ...(opts.worker ? { worker: opts.worker } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<SlotClaimedEvent>;
        if (!a.bountyId) continue;
        onEvent({ bountyId: a.bountyId, worker: a.worker ?? '0x', log });
      }
    },
  });
}

// EarningsWithdrawn

export type EarningsWithdrawnEvent = {
  worker: Address;
  token: Address;
  amount: bigint;
  log: Log;
};

export type EarningsWithdrawnFilter = WatchOptions & {
  worker?: Address;
  token?: Address;
};

/** Subscribe to earnings withdrawal events. Useful for revenue dashboards. */
export function watchEarningsWithdrawn(
  publicClient: PublicClient,
  core: Address,
  opts: EarningsWithdrawnFilter,
  onEvent: (evt: EarningsWithdrawnEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'EarningsWithdrawn',
    args: {
      ...(opts.worker ? { worker: opts.worker } : {}),
      ...(opts.token ? { token: opts.token } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<EarningsWithdrawnEvent>;
        onEvent({
          worker: a.worker ?? '0x',
          token: a.token ?? '0x',
          amount: a.amount ?? 0n,
          log,
        });
      }
    },
  });
}

// CIAttested

export type CIAttestedEvent = {
  bountyId: bigint;
  worker: Address;
  passed: boolean;
  log: Log;
};

export type CIAttestedFilter = WatchOptions & {
  bountyId?: bigint;
  worker?: Address;
};

/**
 * Subscribe to CI attestations from the relayer. For a `ciRequired` bounty,
 * `pickWinner` is only valid for a worker with `passed: true`.
 */
export function watchCIAttested(
  publicClient: PublicClient,
  core: Address,
  opts: CIAttestedFilter,
  onEvent: (evt: CIAttestedEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'CIAttested',
    args: {
      ...(opts.bountyId !== undefined ? { bountyId: opts.bountyId } : {}),
      ...(opts.worker ? { worker: opts.worker } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<CIAttestedEvent>;
        if (a.bountyId === undefined) continue;
        onEvent({ bountyId: a.bountyId, worker: a.worker ?? '0x', passed: a.passed ?? false, log });
      }
    },
  });
}

// StakeSettled

export type StakeSettledEvent = {
  bountyId: bigint;
  worker: Address;
  forfeited: boolean;
  amount: bigint;
  log: Log;
};

export type StakeSettledFilter = WatchOptions & {
  bountyId?: bigint;
  worker?: Address;
};

/**
 * Subscribe to stake settlements. `forfeited: true` means the stake went to
 * the treasury (bad-faith worker); otherwise it was credited back to the worker.
 */
export function watchStakeSettled(
  publicClient: PublicClient,
  core: Address,
  opts: StakeSettledFilter,
  onEvent: (evt: StakeSettledEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'StakeSettled',
    args: {
      ...(opts.bountyId !== undefined ? { bountyId: opts.bountyId } : {}),
      ...(opts.worker ? { worker: opts.worker } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<StakeSettledEvent>;
        if (a.bountyId === undefined) continue;
        onEvent({
          bountyId: a.bountyId,
          worker: a.worker ?? '0x',
          forfeited: a.forfeited ?? false,
          amount: a.amount ?? 0n,
          log,
        });
      }
    },
  });
}

// BountyCancelled

export type BountyCancelledEvent = {
  bountyId: bigint;
  log: Log;
};

export type BountyCancelledFilter = WatchOptions & {
  bountyId?: bigint;
};

/** Subscribe to bounty cancellations (cancelExpired after deadline + grace). */
export function watchBountyCancelled(
  publicClient: PublicClient,
  core: Address,
  opts: BountyCancelledFilter,
  onEvent: (evt: BountyCancelledEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'BountyCancelled',
    args: {
      ...(opts.bountyId !== undefined ? { bountyId: opts.bountyId } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<BountyCancelledEvent>;
        if (a.bountyId === undefined) continue;
        onEvent({ bountyId: a.bountyId, log });
      }
    },
  });
}

// ReputationAttested (v3.1)

export type ReputationAttestedEvent = {
  bountyId: bigint;
  /** ERC-8004 identity NFT id of the winning agent. */
  agentId: bigint;
  /** Winner wallet that owns the agent identity. */
  worker: Address;
  log: Log;
};

export type ReputationAttestedFilter = WatchOptions & {
  bountyId?: bigint;
  agentId?: bigint;
  worker?: Address;
};

/**
 * Subscribe to reputation attestations (v3.1): emitted once per resolved
 * bounty when `attestReputation` writes the winner's +1 ERC-8004 feedback.
 * Filter by `agentId` or `worker` to follow a single agent's reputation.
 */
export function watchReputationAttested(
  publicClient: PublicClient,
  core: Address,
  opts: ReputationAttestedFilter,
  onEvent: (evt: ReputationAttestedEvent) => void,
): UnwatchFn {
  return publicClient.watchContractEvent({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    eventName: 'ReputationAttested',
    args: {
      ...(opts.bountyId !== undefined ? { bountyId: opts.bountyId } : {}),
      ...(opts.agentId !== undefined ? { agentId: opts.agentId } : {}),
      ...(opts.worker ? { worker: opts.worker } : {}),
    },
    pollingInterval: opts.pollingInterval,
    fromBlock: opts.fromBlock,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as Partial<ReputationAttestedEvent>;
        if (a.bountyId === undefined) continue;
        onEvent({
          bountyId: a.bountyId,
          agentId: a.agentId ?? 0n,
          worker: a.worker ?? '0x',
          log,
        });
      }
    },
  });
}

// Convenience: watch all core events

export type CoreEventHandlers = {
  onBountyPosted?: (evt: BountyPostedEvent) => void;
  onDeliverableSubmitted?: (evt: DeliverableSubmittedEvent) => void;
  onBountyResolved?: (evt: BountyResolvedEvent) => void;
  onSlotClaimed?: (evt: SlotClaimedEvent) => void;
  onEarningsWithdrawn?: (evt: EarningsWithdrawnEvent) => void;
  onCIAttested?: (evt: CIAttestedEvent) => void;
  onStakeSettled?: (evt: StakeSettledEvent) => void;
  onBountyCancelled?: (evt: BountyCancelledEvent) => void;
  onReputationAttested?: (evt: ReputationAttestedEvent) => void;
};

/**
 * Start watching all supported v3 events in one call.
 * Returns a single `unwatch` that stops all active subscriptions.
 *
 * @example
 * const unwatch = watchAll(publicClient, V3_CORE, {
 *   onBountyPosted: (e) => console.log('New bounty', e.bountyId),
 *   onBountyResolved: (e) => console.log('Winner', e.winner),
 * })
 */
export function watchAll(
  publicClient: PublicClient,
  core: Address,
  handlers: CoreEventHandlers,
  opts: WatchOptions = {},
): UnwatchFn {
  const unwatchers: UnwatchFn[] = [];

  if (handlers.onBountyPosted) {
    unwatchers.push(watchBountyPosted(publicClient, core, opts, handlers.onBountyPosted));
  }
  if (handlers.onDeliverableSubmitted) {
    unwatchers.push(watchDeliverableSubmitted(publicClient, core, opts, handlers.onDeliverableSubmitted));
  }
  if (handlers.onBountyResolved) {
    unwatchers.push(watchBountyResolved(publicClient, core, opts, handlers.onBountyResolved));
  }
  if (handlers.onSlotClaimed) {
    unwatchers.push(watchSlotClaimed(publicClient, core, opts, handlers.onSlotClaimed));
  }
  if (handlers.onEarningsWithdrawn) {
    unwatchers.push(watchEarningsWithdrawn(publicClient, core, opts, handlers.onEarningsWithdrawn));
  }
  if (handlers.onCIAttested) {
    unwatchers.push(watchCIAttested(publicClient, core, opts, handlers.onCIAttested));
  }
  if (handlers.onStakeSettled) {
    unwatchers.push(watchStakeSettled(publicClient, core, opts, handlers.onStakeSettled));
  }
  if (handlers.onBountyCancelled) {
    unwatchers.push(watchBountyCancelled(publicClient, core, opts, handlers.onBountyCancelled));
  }
  if (handlers.onReputationAttested) {
    unwatchers.push(watchReputationAttested(publicClient, core, opts, handlers.onReputationAttested));
  }

  return () => { for (const u of unwatchers) u(); };
}
