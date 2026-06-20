// Public surface for @yeheskieltame/claudelance-types.
export { BountyStatus, ZERO_ADDRESS, isDirectHire, type Bounty } from './bounty.js';
export type { Submission } from './submission.js';
export type { PendingAddress } from './pending.js';
export {
  CLAUDELANCE_CORE_V3_ABI,
  type ClaudelanceCoreV3Abi,
} from './abi.js';
export {
  MAINNET,
  MAINNET_V3,
  deploymentByChainId,
  type Deployment,
  type TokenSet,
} from './deployments.js';
export {
  TaskType,
  TASK_TYPE_NAMES,
  TASK_TYPE_LABELS,
  TASK_TYPE_DISCLAIMER_REQUIRED,
  type TypeConfig,
} from './task-types.js';
export {
  TASK_DISCLAIMER,
  disclaimerForType,
  buildSubmissionMetadata,
  type DisclaimerAck,
} from './disclaimer.js';
