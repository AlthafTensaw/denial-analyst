# `packages/mock-server/src/index.ts` — PR-4 update

The PR-2 export block for denial-tool needs to be replaced wholesale.
Apply the diff below to `packages/mock-server/src/index.ts`.

```diff
- // Denial Analysis Tool (PR-2)
- export {
-   ConfidenceEnum,
-   ClassificationSourceEnum,
-   RecommendationStatusEnum,
-   OverrideReasonEnum,
-   DupSignalKindEnum,
-   PriorityChipEnum,
-   AgingBucketEnum,
-   AuditEventTypeEnum,
-   RemarkCodeSchema,
-   DenialEventSchema,
-   ClaimRecordSchema,
-   WorkflowStepSchema,
-   ClassificationSchema,
-   RecommendationRowSchema,
-   RecommendationDetailSchema,
-   OverrideRecordSchema,
-   BatchRunFailureSchema,
-   BatchRunSchema,
-   WorklistListRequestSchema,
-   WorklistListResponseSchema,
-   WorklistFacetsResponseSchema,
-   PaginationSchema,
-   ViewTotalsSchema,
-   AcceptRequestSchema,
-   BulkAcceptRequestSchema,
-   BulkAcceptResponseSchema,
-   BulkAcceptRejectedItemSchema,
-   OverrideRequestSchema,
-   BulkOverrideRequestSchema,
-   ExportRequestSchema,
-   RunCreateRequestSchema,
-   RunCreateResponseSchema,
-   RevealPhiFieldRequestSchema,
-   RevealPhiFieldResponseSchema,
-   type Confidence,
-   type ClassificationSource,
-   type RecommendationStatus,
-   type OverrideReason,
-   type DupSignalKind,
-   type PriorityChip,
-   type AgingBucket,
-   type AuditEventType,
-   type RemarkCode,
-   type DenialEvent,
-   type ClaimRecord,
-   type WorkflowStep,
-   type Classification,
-   type RecommendationRow,
-   type RecommendationDetail,
-   type OverrideRecord,
-   type BatchRun,
-   type WorklistListRequest,
-   type WorklistListResponse,
-   type WorklistFacetsResponse,
-   type BulkAcceptResponse,
- } from './schemas/denial';
-
- export {
-   RECOMMENDATIONS,
-   RECOMMENDATIONS_FACETS,
- } from './fixtures/denial/recommendations';
-
- export { buildLatestRun } from './fixtures/denial/batchRun';
-
- export { buildDenialHandlers } from './handlers/denialHandlers';
- export { resetMockDenialState } from './handlers/denialState';
+ // Denial Analysis Tool (PR-4 — rewritten against backend OpenAPI Day 12)
+ export {
+   // Enums
+   ConfidenceEnum,
+   ClassificationSourceEnum,
+   ClassificationStateEnum,
+   OverrideReasonEnum,
+   PriorityChipEnum,
+   AgingBucketEnum,
+   BulkAcceptRejectReasonEnum,
+   // Schemas
+   DecimalStringSchema,
+   WorkflowStepSchema,
+   ClassificationSchema,
+   ClaimSummarySchema,
+   WorklistRowSchema,
+   WorklistResponseSchema,
+   WorklistRequestSchema,
+   AcceptRequestSchema,
+   OverrideRequestSchema,
+   CompleteRequestSchema,
+   StateTransitionResponseSchema,
+   BulkAcceptRequestSchema,
+   BulkAcceptRejectionSchema,
+   BulkAcceptResponseSchema,
+   DailyCostRowSchema,
+   CostSummarySchema,
+   CostQuerySchema,
+   // Constants
+   CATEGORY_VALUES,
+   OVERRIDE_REASON_COPY,
+   // Types
+   type Confidence,
+   type ClassificationSource,
+   type ClassificationState,
+   type OverrideReason,
+   type PriorityChip,
+   type AgingBucket,
+   type BulkAcceptRejectReason,
+   type WorkflowStep,
+   type Classification,
+   type ClaimSummary,
+   type WorklistRow,
+   type WorklistResponse,
+   type WorklistRequest,
+   type AcceptRequest,
+   type OverrideRequest,
+   type CompleteRequest,
+   type StateTransitionResponse,
+   type BulkAcceptRequest,
+   type BulkAcceptRejection,
+   type BulkAcceptResponse,
+   type DailyCostRow,
+   type CostSummary,
+   type CostQuery,
+   type Category,
+ } from './schemas/denial';
+
+ export {
+   WORKLIST_ROWS,
+   WORKLIST_FIXTURE_META,
+ } from './fixtures/denial/recommendations';
+
+ export { buildCostSummary } from './fixtures/denial/costDaily';
+
+ export { buildDenialHandlers } from './handlers/denialHandlers';
+ export { resetMockDenialState } from './handlers/denialState';
```

Note: the PR-2 fixture file `fixtures/denial/batchRun.ts` becomes
dead code (the `/v1/runs/latest` endpoint no longer exists). Delete
it as part of the PR-4 patch:

```bash
rm packages/mock-server/src/fixtures/denial/batchRun.ts
```
