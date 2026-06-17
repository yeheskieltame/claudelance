/** Canonical task type IDs for ClaudelanceCoreV3 (uint8, 0-10). */
export enum TaskType {
  Code = 0,
  DataAnalysis = 1,
  Research = 2,
  Content = 3,
  DocReview = 4,
  CodeAudit = 5,
  Translation = 6,
  Education = 7,
  Legal = 8,
  Finance = 9,
  Custom = 10,
}

export const TASK_TYPE_NAMES: Record<TaskType, string> = {
  [TaskType.Code]: 'Code',
  [TaskType.DataAnalysis]: 'Data Analysis',
  [TaskType.Research]: 'Research',
  [TaskType.Content]: 'Content',
  [TaskType.DocReview]: 'Doc Review',
  [TaskType.CodeAudit]: 'Code Audit',
  [TaskType.Translation]: 'Translation',
  [TaskType.Education]: 'Education',
  [TaskType.Legal]: 'Legal',
  [TaskType.Finance]: 'Finance',
  [TaskType.Custom]: 'Custom',
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  [TaskType.Code]: 'CODE',
  [TaskType.DataAnalysis]: 'DATA_ANALYSIS',
  [TaskType.Research]: 'RESEARCH',
  [TaskType.Content]: 'CONTENT',
  [TaskType.DocReview]: 'DOC_REVIEW',
  [TaskType.CodeAudit]: 'CODE_AUDIT',
  [TaskType.Translation]: 'TRANSLATION',
  [TaskType.Education]: 'EDUCATION',
  [TaskType.Legal]: 'LEGAL',
  [TaskType.Finance]: 'FINANCE',
  [TaskType.Custom]: 'CUSTOM',
};

/** True for types that require a legal/financial disclaimer from the worker. */
export const TASK_TYPE_DISCLAIMER_REQUIRED: Record<TaskType, boolean> = {
  [TaskType.Code]: false,
  [TaskType.DataAnalysis]: false,
  [TaskType.Research]: false,
  [TaskType.Content]: false,
  [TaskType.DocReview]: false,
  [TaskType.CodeAudit]: false,
  [TaskType.Translation]: false,
  [TaskType.Education]: false,
  [TaskType.Legal]: true,
  [TaskType.Finance]: true,
  [TaskType.Custom]: false,
};

/** TypeConfig struct mirroring the on-chain struct. */
export type TypeConfig = {
  enabled: boolean;
  ciSupported: boolean;
  /** Relayer hint: relayer checks disclaimer ack for Legal (8) and Finance (9). */
  disclaimerRequired: boolean;
  /** 0 = poster-only review; reserved for future multi-reviewer quorum. */
  minReviewers: number;
};
