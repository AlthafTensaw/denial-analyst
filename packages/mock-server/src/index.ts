/**
 * @tensaw/mock-server
 *
 * Browser-side mock backend for the AR Mgmt Portal demo. Built on MSW.
 *
 * The mock implements the same wire envelope, paging contract, and validation
 * rules the real backend will. The OpenAPI scaffold (in tools/openapi-emitter)
 * is generated from the same schemas the mock uses.
 *
 * Usage in the patient app:
 *
 *   import { setupWorker } from 'msw/browser';
 *   import { buildARHandlers } from '@tensaw/mock-server';
 *   import { config } from '@tensaw/runtime';
 *
 *   if (import.meta.env.DEV) {
 *     const worker = setupWorker(...buildARHandlers(config.api.baseUrl));
 *     await worker.start();
 *   }
 */

export const PACKAGE_VERSION = '0.0.0';

// Schemas — also exported so the OpenAPI emitter and the actions registry
// can reference the same source of truth.
export {
  ClaimStatusEnum,
  PriorityEnum,
  WorklistModeEnum,
  KnownWorkflowNameEnum,
  ARRowSchema,
  ARListRequestSchema,
  ARListResponseSchema,
  UpdateOwnerRequestSchema,
  UpdateDueDateRequestSchema,
  BulkUpdateOwnerRequestSchema,
  BulkUpdateDueDateRequestSchema,
  AddToWorkflowRequestSchema,
  AddToWorkflowResponseSchema,
  RefDataItemSchema,
  RefDataResponseSchema,
  type ClaimStatus,
  type Priority,
  type WorklistMode,
  type ARRow,
  type ARListRequest,
  type ARListResponse,
  type RefDataItem,
} from './schemas/ar';

// Fixtures
export {
  CLINICS,
  PROVIDERS,
  PAYERS,
  OWNERS,
} from './fixtures/refData';
export {
  WORKING_LIST_ROWS,
  ADD_TO_WORKFLOW_ROWS,
} from './fixtures/arRows';

// Handlers
export { buildARHandlers } from './handlers/arHandlers';
export { resetMockARState } from './handlers/arState';

// Denial Analysis Tool (PR-4 — rewritten against backend OpenAPI Day 12)
export {
  // Enums
  ConfidenceEnum,
  ClassificationSourceEnum,
  ClassificationStateEnum,
  OverrideReasonEnum,
  PriorityChipEnum,
  AgingBucketEnum,
  BulkAcceptRejectReasonEnum,
  // Schemas
  DecimalStringSchema,
  WorkflowStepSchema,
  ClassificationSchema,
  ClaimSummarySchema,
  WorklistRowSchema,
  WorklistResponseSchema,
  WorklistRequestSchema,
  AcceptRequestSchema,
  OverrideRequestSchema,
  CompleteRequestSchema,
  StateTransitionResponseSchema,
  BulkAcceptRequestSchema,
  BulkAcceptRejectionSchema,
  BulkAcceptResponseSchema,
  DailyCostRowSchema,
  CostSummarySchema,
  CostQuerySchema,
  // Constants
  CATEGORY_VALUES,
  OVERRIDE_REASON_COPY,
  // Types
  type Confidence,
  type ClassificationSource,
  type ClassificationState,
  type OverrideReason,
  type PriorityChip,
  type AgingBucket,
  type BulkAcceptRejectReason,
  type WorkflowStep,
  type Classification,
  type ClaimSummary,
  type WorklistRow,
  type WorklistResponse,
  type WorklistRequest,
  type AcceptRequest,
  type OverrideRequest,
  type CompleteRequest,
  type StateTransitionResponse,
  type BulkAcceptRequest,
  type BulkAcceptRejection,
  type BulkAcceptResponse,
  type DailyCostRow,
  type CostSummary,
  type CostQuery,
  type Category,
} from './schemas/denial';

export {
  WORKLIST_ROWS,
  WORKLIST_FIXTURE_META,
} from './fixtures/denial/recommendations';

export { buildCostSummary } from './fixtures/denial/costDaily';

export { buildDenialHandlers } from './handlers/denialHandlers';
export { resetMockDenialState } from './handlers/denialState';
