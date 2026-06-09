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
import { BountyStatus } from '@yeheskieltame/claudelance-sdk';
import type { ParsedCiEvent } from './github.js';

export type Logger = (message: string, meta?: Record<string, unknown>) => void;

const defaultLogger: Logger = (message, meta) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), message, ...meta }));

export type TickSummary = {
  scanned: number;
  actions: number;
  executed: number;
  failed: number;
};

/**
 * One keeper pass: scan every bounty and run any due permissionless action
 * (cancel an expired bounty, settle a locked stake). In dry-run mode actions
 * are logged but not broadcast.
 */
export async function runKeeperTick(
  chain: ChainClient,
  cfg: RelayerConfig,
  log: Logger = defaultLogger,
): Promise<TickSummary> {
  const count = await chain.bountyCount();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const summary: TickSummary = { scanned: 0, actions: 0, executed: 0, failed: 0 };

  for (let id = 1n; id <= count; id++) {
    summary.scanned++;
    const bounty = await chain.getBounty(id);

    // Cheap skip: an open bounty still inside its window has nothing to do.
    if (bounty.status === BountyStatus.Open && now < bounty.deadline + GRACE_PERIOD_SECONDS) {
      continue;
    }

    let claimers: ClaimerState[] = [];
    if (bounty.status === BountyStatus.Resolved || bounty.status === BountyStatus.Cancelled) {
      claimers = await collectClaimerStates(chain, id);
    }

    const actions = decideKeeperActions(id, bounty, claimers, now);
    for (const action of actions) {
      summary.actions++;
      await execute(chain, cfg, action, log, summary);
    }
  }

  log('keeper.tick', { ...summary, dryRun: cfg.dryRun });
  return summary;
}

async function collectClaimerStates(chain: ChainClient, bountyId: bigint): Promise<ClaimerState[]> {
  const claimers = await chain.getClaimers(bountyId);
  const states: ClaimerState[] = [];
  for (const worker of claimers) {
    const submission = await chain.getSubmission(bountyId, worker);
    states.push({ worker, stakeSettled: submission.stakeSettled });
  }
  return states;
}

async function execute(
  chain: ChainClient,
  cfg: RelayerConfig,
  action: KeeperAction,
  log: Logger,
  summary: TickSummary,
): Promise<void> {
  if (cfg.dryRun) {
    log('keeper.dry-run', { action: action.kind, ...actionMeta(action) });
    return;
  }
  try {
    const tx =
      action.kind === 'cancelExpired'
        ? await chain.cancelExpired(action.bountyId)
        : await chain.settleStake(action.bountyId, action.worker);
    summary.executed++;
    log('keeper.sent', { action: action.kind, tx, ...actionMeta(action) });
  } catch (err) {
    summary.failed++;
    log('keeper.error', { action: action.kind, error: errorMessage(err), ...actionMeta(action) });
  }
}

function actionMeta(action: KeeperAction): Record<string, unknown> {
  return action.kind === 'cancelExpired'
    ? { bountyId: action.bountyId.toString() }
    : { bountyId: action.bountyId.toString(), worker: action.worker };
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
