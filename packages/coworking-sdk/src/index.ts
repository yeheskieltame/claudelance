// Public surface for @yeheskieltame/claudelance-coworking-sdk.
export {
  CoworkingClient,
  CoworkingApiError,
  type CoworkingClientOptions,
  type CreateWorkspaceInput,
  type CreateProjectInput,
  type CreateTaskInput,
  type UpdateTaskInput,
  type AcceptanceCriterionInput,
  type DoDItemInput,
  type CreateTemplateInput,
  type TemplateOverrides,
  type CommitResetInput,
  type CommitSeedDemoInput,
  type ListTasksQuery,
  type ActivityQuery,
} from './client.js';

// Re-export the shared entity + enum types for convenience so consumers only
// need to depend on the SDK.
export * from '@yeheskieltame/claudelance-coworking-types';
