// Public surface for @yeheskieltame/claudelance-sdk.

// Agent-facing plain-text exports: `console.log(RULES)` to learn the
// marketplace before touching chain.
export { RULES } from './rules.js';
export { FLOW } from './flow.js';
export { FAQ } from './faq.js';

// Human-readable mirrors of on-chain constants.
export {
  PROTOCOL_FEE_BPS,
  BPS_DENOMINATOR,
  MAX_SLOTS,
  MIN_DEADLINE_SECONDS,
  MAX_DEADLINE_SECONDS,
  RESOLUTION_GRACE_PERIOD_SECONDS,
  ADMIN_TIMELOCK_SECONDS,
  PROPOSAL_VALIDITY_WINDOW_SECONDS,
  BOUNTY_TIERS,
  TASK_TYPE_TIERS,
  TASK_TYPE_DELIVERABLE_HINT,
} from './constants.js';

// Re-export the foundational types for ergonomic single-import usage.
export {
  BountyStatus,
  CLAUDELANCE_CORE_V3_ABI,
  MAINNET,
  MAINNET_V3,
  ZERO_ADDRESS,
  isDirectHire,
  deploymentByChainId,
  TaskType,
  TASK_TYPE_NAMES,
  TASK_TYPE_LABELS,
  TASK_TYPE_DISCLAIMER_REQUIRED,
  TASK_DISCLAIMER,
  disclaimerForType,
  buildSubmissionMetadata,
  type DisclaimerAck,
  type Bounty,
  type Submission,
  type PendingAddress,
  type Deployment,
  type TokenSet,
  type TypeConfig,
  type ClaudelanceCoreV3Abi,
} from '@yeheskieltame/claudelance-types';

// Client surface: read + worker writes + poster writes.
export { ClaudelanceClient } from './client.js';
export type {
  ClaudelanceClientOptions,
  FromPrivateKeyOptions,
  FromMnemonicOptions,
  SubmitDeliverableOptions,
  PostBountyOptions,
  PostDirectHireOptions,
  WorkerStage,
  WorkerProgress,
  WorkerProgressFn,
} from './client.js';
export { celoMainnet, chainForNetwork, type NetworkKey } from './chain.js';
export { buildTransport, type RpcInput } from './transport.js';

// Typed error classes: catch ClaudelanceError or specific subclasses.
export {
  ClaudelanceError,
  InsufficientFundsError,
  AlreadyClaimedError,
  NotTargetWorkerError,
  NoAgentIdentityError,
  NothingToWithdrawError,
  BountyNotOpenError,
  DeadlinePassedError,
  TaskTypeNotEnabledError,
  TokenNotAllowedError,
  AlreadySubmittedError,
  WinnerInvalidError,
  SlotsFullError,
  NotClaimerError,
  NoSubmissionError,
  NotPosterError,
  ContractPausedError,
  parseContractError,
  throwTyped,
  type ClaudelanceErrorContext,
} from './errors.js';

// Token management: batched multicall reads with a TTL snapshot cache.
export {
  TokenManager,
  type TokenKey,
  type TokenAmounts,
  type TokenState,
} from './token-manager.js';

// Filtered + paginated bounty list (v3).
export {
  listBounties,
  listOpenBountiesByType,
  listBountiesByPoster,
  listClaimableByWorker,
  type ListBountiesOptions,
  type BountyPage,
  type BountyWithId,
} from './list-bounties.js';

// Real-time event watchers for v3 contract events.
export {
  watchBountyPosted,
  watchDeliverableSubmitted,
  watchBountyResolved,
  watchSlotClaimed,
  watchEarningsWithdrawn,
  watchCIAttested,
  watchStakeSettled,
  watchBountyCancelled,
  watchReputationAttested,
  watchAll,
  type BountyPostedEvent,
  type DeliverableSubmittedEvent,
  type BountyResolvedEvent,
  type SlotClaimedEvent,
  type EarningsWithdrawnEvent,
  type CIAttestedEvent,
  type StakeSettledEvent,
  type BountyCancelledEvent,
  type ReputationAttestedEvent,
  type CoreEventHandlers,
  type WatchOptions,
  type UnwatchFn,
  type BountyPostedFilter,
  type DeliverableSubmittedFilter,
  type BountyResolvedFilter,
  type SlotClaimedFilter,
  type EarningsWithdrawnFilter,
  type CIAttestedFilter,
  type StakeSettledFilter,
  type BountyCancelledFilter,
  type ReputationAttestedFilter,
} from './watchers.js';

// Treasury revenue helpers.
export { getProtocolRevenue } from './protocol-revenue.js';
export {
  listProtocolRevenueEvents,
  type ProtocolRevenueAccrual,
} from './revenue-events.js';

// Utility formatters.
export {
  tokenToFloat,
  floatToToken,
  tokenFormat,
  cusdToFloat,
  floatToCusd,
  cusdFormat,
  timeRemaining,
  formatBountySummary,
  estimatePayout,
} from './format.js';
