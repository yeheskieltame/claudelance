import { TaskType } from './task-types.js';

/**
 * Worker-facing disclaimer for the task types that require an acknowledgment
 * (Legal and Finance). The worker affirms this before submitting, and the ack
 * is recorded in the on-chain submission metadata for the relayer to verify.
 */
export const TASK_DISCLAIMER: Partial<Record<TaskType, string>> = {
  [TaskType.Legal]:
    "This deliverable is general information, not licensed legal advice. The worker is not acting as the poster's lawyer and no attorney-client relationship is formed. Consult a qualified lawyer before relying on it.",
  [TaskType.Finance]:
    "This deliverable is general information, not licensed financial, investment, or tax advice. The worker is not acting as the poster's financial adviser. Consult a qualified professional before relying on it.",
};

/** The disclaimer text a task type requires, or undefined if none. */
export function disclaimerForType(type: number): string | undefined {
  return TASK_DISCLAIMER[type as TaskType];
}

/** Disclaimer acknowledgment embedded in the submission `metadata` JSON. */
export type DisclaimerAck = {
  acknowledged: true;
  taskType: number;
  text: string;
  /** Unix seconds when the worker acknowledged. */
  at: number;
};

/**
 * Build the submission `metadata` string, embedding a disclaimer ack when the
 * task type requires one and the worker acknowledged it. `at` is unix seconds;
 * the caller supplies the clock so this stays pure.
 */
export function buildSubmissionMetadata(opts: {
  taskType: number;
  at: number;
  ack?: boolean;
  extra?: Record<string, unknown>;
}): string {
  const out: Record<string, unknown> = { ...(opts.extra ?? {}) };
  const text = disclaimerForType(opts.taskType);
  if (text && opts.ack) {
    const ack: DisclaimerAck = { acknowledged: true, taskType: opts.taskType, text, at: opts.at };
    out.disclaimer = ack;
  }
  return JSON.stringify(out);
}
