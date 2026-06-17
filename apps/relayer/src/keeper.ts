import type { Address } from 'viem';

import type { ChainClient } from './chain.js';
import type { RelayerConfig } from './config.js';
import {
  GRACE_PERIOD_SECONDS,
  decideAttest,
  decideKeeperActions,
  deliverableMatchesCi,
  shouldReattest,
  type ClaimerState,
  type KeeperAction,
} from './decisions.js';
import { BountyStatus, ZERO_ADDRESS } from '@yeheskieltame/claudelance-sdk';
import type { ParsedCiEvent } from './github.js';

export type Logger = (message: string, meta?: Record<string, unknown>) => void;

const defaultLogger: Logger = (message, meta) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), message, ...meta }));

export type TickSummary = {
  scanned: number;
  actions: number;
  executed: number;
  failed: number;
  skipped: number;
  watermark: bigint;
  durationMs: number;
};

/**
 * agentId resolution cache shared across ticks. Positive entries are
 * permanent (an Identity NFT id never changes); negative entries stop the
 * keeper from repeating an expensive mint scan every tick for a worker that
 * has no identity in range.
 */
export type AgentIdCache = {
  byWorker: Map<string, bigint>;
  unresolvable: Set<string>;
};

export function createAgentIdCache(): AgentIdCache {
  return { byWorker: new Map(), unresolvable: new Set() };
}

/**
 * Cross-tick keeper state. `watermark` is the highest bounty id known to be
 * terminal-and-done (nothing the keeper could ever do below it: stakes all
 * settled, reputation attested where due), so steady-state ticks only read
 * the live tail. In-memory by design: a restart pays one full rescan, which
 * the batched reads make cheap.
 */
export type KeeperState = {
  watermark: bigint;
  cache: AgentIdCache;
};

export function createKeeperState(): KeeperState {
  return { watermark: 0n, cache: createAgentIdCache() };
}

const LOW_BALANCE_WEI = 300_000_000_000_000_000n; // 0.3 CELO
const SCAN_PAGE = 50;

type BountyRow = {
  id: bigint;
  bounty: Awaited<ReturnType<ChainClient['getBounty']>>;
  claimers: ClaimerState[];
  attested: boolean;
};

/**
 * One keeper pass. Reads the live tail (everything above the watermark) in
 * Multicall3 pages, decides all due permissionless actions, then broadcasts
 * them back to back on sequential nonces and awaits the receipts together.
 * In dry-run mode actions are logged but not broadcast.
 */
export async function runKeeperTick(
  chain: ChainClient,
  cfg: RelayerConfig,
  log: Logger = defaultLogger,
  state: KeeperState = createKeeperState(),
): Promise<TickSummary> {
  const t0 = Date.now();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const summary: TickSummary = {
    scanned: 0,
    actions: 0,
    executed: 0,
    failed: 0,
    skipped: 0,
    watermark: state.watermark,
    durationMs: 0,
  };

  if (!cfg.dryRun) {
    const balance = await chain.relayerBalance();
    if (balance < LOW_BALANCE_WEI) {
      log('keeper.low-balance', { relayer: chain.relayerAddress, balanceWei: balance.toString() });
    }
  }

  // 1. Page the live tail. The empty struct (poster == zero) marks the end of
  //    the id space, so no bountyCount probe is needed.
  const rows: BountyRow[] = [];
  for (let start = state.watermark + 1n; ; start += BigInt(SCAN_PAGE)) {
    const page = await chain.getBountiesRange(start, SCAN_PAGE);
    let ended = false;
    for (let i = 0; i < page.length; i++) {
      const bounty = page[i];
      if (!bounty || bounty.poster === ZERO_ADDRESS) {
        ended = true;
        break;
      }
      rows.push({ id: start + BigInt(i), bounty, claimers: [], attested: true });
    }
    if (ended) break;
  }
  summary.scanned = rows.length;

  // 2. Batch-load claimer + attestation state for everything settleable.
  const settleable = rows.filter(
    (r) =>
      r.bounty.status === BountyStatus.Resolved || r.bounty.status === BountyStatus.Cancelled,
  );
  const claimerLists = await chain.getClaimersBatch(settleable.map((r) => r.id));
  const pairs: Array<{ bountyId: bigint; worker: Address; row: BountyRow }> = [];
  settleable.forEach((row, i) => {
    for (const worker of claimerLists[i] ?? []) pairs.push({ bountyId: row.id, worker, row });
  });
  const submissions = await chain.getSubmissionsBatch(
    pairs.map((p) => ({ bountyId: p.bountyId, worker: p.worker })),
  );
  pairs.forEach((p, i) => {
    p.row.claimers.push({ worker: p.worker, stakeSettled: submissions[i]?.stakeSettled ?? true });
  });

  const resolved = settleable.filter((r) => r.bounty.status === BountyStatus.Resolved);
  const attestedFlags = await chain.isReputationAttestedBatch(resolved.map((r) => r.id));
  resolved.forEach((row, i) => {
    row.attested = attestedFlags[i] ?? true;
  });

  // 3. Decide.
  const planned: KeeperAction[] = [];
  const actionableIds = new Set<string>();
  for (const row of rows) {
    const actions = decideKeeperActions(row.id, row.bounty, row.claimers, now, row.attested);
    for (const action of actions) {
      planned.push(action);
      actionableIds.add(row.id.toString());
    }
  }
  summary.actions = planned.length;

  // 4. Advance the watermark over the contiguous done prefix. An id with
  //    actions planned this tick stays above the watermark until a later tick
  //    confirms it terminal, so nothing is ever skipped on a failed send.
  for (const row of rows) {
    if (row.id !== state.watermark + 1n) break;
    if (actionableIds.has(row.id.toString())) break;
    const terminal =
      (row.bounty.status === BountyStatus.Resolved && row.attested) ||
      row.bounty.status === BountyStatus.Cancelled;
    if (!terminal || row.claimers.some((c) => !c.stakeSettled)) break;
    state.watermark = row.id;
  }
  summary.watermark = state.watermark;

  // 5. Execute: resolve agent ids first, then broadcast on sequential nonces
  //    and await all receipts together.
  await executeBatch(chain, cfg, planned, log, summary, state.cache);

  summary.durationMs = Date.now() - t0;
  log('keeper.tick', {
    ...summary,
    watermark: summary.watermark.toString(),
    dryRun: cfg.dryRun,
  });
  return summary;
}

async function executeBatch(
  chain: ChainClient,
  cfg: RelayerConfig,
  planned: KeeperAction[],
  log: Logger,
  summary: TickSummary,
  cache: AgentIdCache,
): Promise<void> {
  type Ready = { action: KeeperAction; agentId: bigint | null };
  const ready: Ready[] = [];
  for (const action of planned) {
    if (action.kind === 'attestReputation') {
      const agentId = await resolveAgentId(chain, cfg, action.winner, cache, log);
      if (agentId === null) {
        summary.skipped++;
        continue;
      }
      ready.push({ action, agentId });
    } else {
      ready.push({ action, agentId: null });
    }
  }

  if (cfg.dryRun) {
    for (const r of ready) log('keeper.dry-run', { action: r.action.kind, ...actionMeta(r.action, r.agentId) });
    return;
  }
  if (ready.length === 0) return;

  const gasPrice = await chain.gasPrice();
  let nonce = await chain.pendingNonce();
  const inFlight: Array<Promise<void>> = [];

  for (const { action, agentId } of ready) {
    try {
      // Send claims the next nonce only on success, so a rejected or
      // failed-simulation send leaves no gap in the lane.
      const tx =
        action.kind === 'cancelExpired'
          ? await chain.cancelExpired(action.bountyId, { nonce, gasPrice })
          : action.kind === 'settleStake'
            ? await chain.settleStake(action.bountyId, action.worker, { nonce, gasPrice })
            : await chain.attestReputation(action.bountyId, agentId as bigint, { nonce, gasPrice });
      nonce++;
      inFlight.push(
        chain.waitForReceipt(tx).then(
          (status) => {
            if (status === 'success') {
              summary.executed++;
              log('keeper.sent', { action: action.kind, tx, ...actionMeta(action, agentId) });
            } else {
              summary.failed++;
              log('keeper.reverted', { action: action.kind, tx, ...actionMeta(action, agentId) });
            }
          },
          (err: unknown) => {
            summary.failed++;
            log('keeper.receipt-error', {
              action: action.kind,
              tx,
              error: errorMessage(err),
              ...actionMeta(action, agentId),
            });
          },
        ),
      );
    } catch (err) {
      const message = errorMessage(err);
      // A tick triggered right after sends can re-plan work whose receipts a
      // lagging replica has not surfaced yet; the simulation then reverts
      // with the contract's already-done guard. That is convergence, not
      // failure, and no gas was spent.
      if (message.includes('StakeAlreadySettled') || message.includes('AlreadyAttested')) {
        summary.skipped++;
        log('keeper.already-done', { action: action.kind, ...actionMeta(action, agentId) });
        continue;
      }
      summary.failed++;
      log('keeper.error', {
        action: action.kind,
        error: message,
        ...actionMeta(action, agentId),
      });
    }
  }

  await Promise.all(inFlight);
}

/**
 * Resolve and verify the winner's agentId for an attest action. Returns null
 * (and logs why) when the worker has no identity in scan range or no longer
 * holds the NFT - those bounties are skipped, never failed.
 */
async function resolveAgentId(
  chain: ChainClient,
  cfg: RelayerConfig,
  winner: `0x${string}`,
  cache: AgentIdCache,
  log: Logger,
): Promise<bigint | null> {
  const key = winner.toLowerCase();
  if (cache.unresolvable.has(key)) return null;

  let agentId = cache.byWorker.get(key) ?? null;
  if (agentId === null) {
    agentId = await chain.findAgentIdByOwner(winner, cfg.identityEventsFromBlock);
    if (agentId === null) {
      cache.unresolvable.add(key);
      log('keeper.agent-unresolvable', { worker: winner });
      return null;
    }
    cache.byWorker.set(key, agentId);
  }

  const owner = await chain.identityOwnerOf(agentId);
  if (owner?.toLowerCase() !== key) {
    // NFT moved since it was minted/cached; drop the stale entry and re-scan next tick.
    cache.byWorker.delete(key);
    log('keeper.agent-owner-mismatch', { worker: winner, agentId: agentId.toString() });
    return null;
  }
  return agentId;
}

function actionMeta(action: KeeperAction, agentId: bigint | null): Record<string, unknown> {
  switch (action.kind) {
    case 'cancelExpired':
      return { bountyId: action.bountyId.toString() };
    case 'settleStake':
      return { bountyId: action.bountyId.toString(), worker: action.worker };
    case 'attestReputation':
      return {
        bountyId: action.bountyId.toString(),
        worker: action.winner,
        agentId: agentId?.toString(),
      };
  }
}

export type WebhookResult = {
  matched: boolean;
  attested: boolean;
  tx?: `0x${string}`;
  reason?: string;
};

/**
 * Handle a parsed CI webhook: map the run's head SHA back to an on-chain
 * submission and, when the bounty requires CI and its task type supports it,
 * attest the result. Idempotent: skips when the on-chain verdict already matches.
 */
export async function handleCiWebhook(
  chain: ChainClient,
  cfg: RelayerConfig,
  event: ParsedCiEvent,
  log: Logger = defaultLogger,
): Promise<WebhookResult> {
  const match = await chain.findSubmission(
    (ref) => deliverableMatchesCi(ref, event.prUrls, event.headSha),
    cfg.eventsFromBlock,
  );
  if (!match) {
    log('webhook.no-match', { headSha: event.headSha, repo: event.repo, prUrls: event.prUrls });
    return { matched: false, attested: false, reason: 'no submission for this run' };
  }

  const bounty = await chain.getBounty(match.bountyId);
  const typeConfig = await chain.getTaskTypeConfig(bounty.bountyType);
  const action = decideAttest(event.conclusion, {
    bountyId: match.bountyId,
    worker: match.worker as Address,
    bountyStatus: bounty.status,
    ciRequired: bounty.ciRequired,
    ciSupported: typeConfig.ciSupported,
  });
  if (!action) {
    log('webhook.skip', {
      bountyId: match.bountyId.toString(),
      worker: match.worker,
      conclusion: event.conclusion,
      ciRequired: bounty.ciRequired,
      ciSupported: typeConfig.ciSupported,
    });
    return { matched: true, attested: false, reason: 'no attestation needed' };
  }

  const submission = await chain.getSubmission(match.bountyId, match.worker as Address);
  if (!shouldReattest(submission, action.passed)) {
    return { matched: true, attested: false, reason: 'already attested with same verdict' };
  }

  if (cfg.dryRun) {
    log('webhook.dry-run', {
      bountyId: action.bountyId.toString(),
      worker: action.worker,
      passed: action.passed,
    });
    return { matched: true, attested: false, reason: 'dry-run' };
  }

  const tx = await chain.attestCI(action.bountyId, action.worker as Address, action.passed);
  log('webhook.attested', {
    bountyId: action.bountyId.toString(),
    worker: action.worker,
    passed: action.passed,
    tx,
  });
  return { matched: true, attested: true, tx };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
