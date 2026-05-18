/**
 * Denial Analysis Tool — Zod schemas (PR-4 rewrite).
 *
 * Authored against the live backend OpenAPI spec (denial-tool-service
 * Phase 1 Day 12) and verified against the Pydantic models in
 * denial_tool_service/domain/models.py. This replaces the PR-2 schemas
 * which were built against the v1 tech spec before the backend's
 * Day-8/9/12 scope corrections landed.
 *
 * Key deviations from PR-2:
 *   - Primary identifier is classification_id (UUID), not recommendation_id (int).
 *   - Row state field is `state`, not `status`.
 *   - Money fields (`amount`, `net_pending`) are Decimal strings on the
 *     wire, not numbers. Frontend must Number() for math but render the
 *     raw string for display to avoid float precision drift.
 *   - Worklist row is { claim: ClaimSummary, classification: Classification }
 *     — no flat duplication of payer/dos/etc.
 *   - PriorityChip is 6 values (down from 11). OVERRIDE_PATTERN replaces
 *     the dropped dup-variants and appeal/reviewed chips.
 *   - OverrideReason is 5 values (added `worked_outside_tool` per Day-8).
 *   - Aging-bucket labels match backend: "0-29 day" / "30-59 day" / etc.
 *   - No response envelope. Backend returns bare Pydantic; mock-server
 *     matches that shape so dev and prod look identical.
 *   - Error responses are RFC 7807 problem-details, parsed via lib/problem.
 */

import { z } from 'zod';

// ===========================================================================
// Enums
// ===========================================================================

export const ConfidenceEnum = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceEnum>;

export const ClassificationSourceEnum = z.enum(['rule', 'llm']);
export type ClassificationSource = z.infer<typeof ClassificationSourceEnum>;

export const ClassificationStateEnum = z.enum([
  'recommended',
  'accepted',
  'overridden',
  'completed',
]);
export type ClassificationState = z.infer<typeof ClassificationStateEnum>;

export const OverrideReasonEnum = z.enum([
  'tool_wrong',
  'tool_right_but_alternate_path',
  'edge_case',
  'data_error',
  'worked_outside_tool',
]);
export type OverrideReason = z.infer<typeof OverrideReasonEnum>;

/**
 * PriorityChip — 6 values per the backend's consolidation.
 *
 * Per Day-8 scope correction:
 *   - The 4 dup-related chips (DUP_OF_EARLIER, DUP_SIGNAL, etc.) consolidated
 *     into a single DUP_INVESTIGATE chip; the variant signal moved to risk_flags.
 *   - APPEAL_2 / APPEAL_3 / REVIEWED moved to risk_flags + current_status_label.
 *   - MULTI_CODE dropped (covered by risk_flags).
 *   - OVERRIDE_PATTERN added — tool's category has high override rate; surfaces
 *     when override pattern detector flags the row.
 */
export const PriorityChipEnum = z.enum([
  'HIGH_DOLLAR',
  'LOW_CONFIDENCE',
  'DUP_INVESTIGATE',
  'TF_WATCH',
  'OVERRIDE_PATTERN',
  'DATA_ERROR',
]);
export type PriorityChip = z.infer<typeof PriorityChipEnum>;

/**
 * Aging buckets — backend labels include the unit "day" suffix.
 *
 * Note: this is a closed enum on the FE, but the wire schema uses
 * `aging_bucket: string | null` since the backend reserves the right
 * to add new buckets. Frontend treats unknown values as a display-only
 * passthrough.
 */
export const AgingBucketEnum = z.enum([
  '0-29 day',
  '30-59 day',
  '60-89 day',
  '90-119 day',
  '120-179 day',
  '180+ day',
]);
export type AgingBucket = z.infer<typeof AgingBucketEnum>;

/**
 * Bulk-accept rejection reasons. Match backend's
 * `BulkAcceptRejectReason` enum exactly.
 *
 * Note: PR-2/PR-3's `category_mismatch` is NOT a backend reason. The
 * D-19 strict gate is confidence + human-review only; the FE's
 * single-shared-category constraint was an over-enforcement. d19Gate.ts
 * still enforces it client-side as a UX rule but the server will accept
 * cross-category selections — we just won't issue them.
 */
export const BulkAcceptRejectReasonEnum = z.enum([
  'NOT_FOUND',
  'INVALID_STATE',
  'LOW_CONFIDENCE',
  'REQUIRES_HUMAN_REVIEW',
]);
export type BulkAcceptRejectReason = z.infer<
  typeof BulkAcceptRejectReasonEnum
>;

// ===========================================================================
// Money — Decimal-as-string
// ===========================================================================

/**
 * Backend serializes Pydantic Decimal as string with this regex:
 *   ^(?!^[-+.]*$)[+-]?0*\d*\.?\d*$
 *
 * We mirror it. The frontend must Number() for math; render as-is for display.
 */
export const DecimalStringSchema = z
  .string()
  .regex(/^(?!^[-+.]*$)[+-]?0*\d*\.?\d*$/);

// ===========================================================================
// Workflow step (per §9.3, backend WorkflowStep model)
// ===========================================================================

export const WorkflowStepSchema = z.object({
  step: z.number().int().min(1),
  action: z.string(),
  owner: z.string(),
  sla_days: z.number().int().min(0),
  mode: z.string().default('Manual'),
  // Backend addition: human-readable bucket like "Day 0-3", "Day 21+".
  day: z.string().nullable().optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ===========================================================================
// Classification
// ===========================================================================

export const ClassificationSchema = z.object({
  classification_id: z.string().uuid(),
  claim_id: z.number().int(),
  classified_at: z.string(), // ISO datetime with Z suffix
  tool_version: z.string(),
  training_guide_version: z.string(),

  // Classification output
  primary_category: z.string(),
  training_guide_section: z.string().nullable(),
  alternate_categories: z.array(z.string()).default([]),
  classification_source: ClassificationSourceEnum,
  rule_id: z.string().nullable(),
  confidence: ConfidenceEnum,

  // Workflow
  workflow_steps: z.array(WorkflowStepSchema).default([]),
  branch_chosen: z.string().nullable(),
  recommended_owner: z.string(),
  sla_next_action_date: z.string(), // ISO date

  // Review gates
  priority_chips: z.array(PriorityChipEnum).default([]),
  risk_flags: z.array(z.string()).default([]),
  requires_human_review: z.boolean(),

  reasoning_summary: z.string(),

  // State (NOT status — backend field name is `state`)
  state: ClassificationStateEnum.default('recommended'),
});
export type Classification = z.infer<typeof ClassificationSchema>;

// ===========================================================================
// ClaimSummary
// ===========================================================================

export const ClaimSummarySchema = z.object({
  claim_id: z.number().int(),
  clinic: z.string().nullable(),
  primary_payer_name: z.string().nullable(),
  dos: z.string(), // ISO date
  amount: DecimalStringSchema,
  net_pending: DecimalStringSchema,
  aging_bucket: z.string().nullable(),
  cpt_lines: z.array(z.string()).default([]),
  appeal_status: z.string().nullable(),
  // Per D-13: backend surfaces any claim with a denial event in the last
  // 12 months regardless of current STATUS. UI renders a badge when
  // current_status_label != "Denied" and surfaces the worked-outside-tool
  // override action prominently.
  current_status_code: z.number().int().nullable().default(null),
  current_status_label: z.string().nullable().default(null),
});
export type ClaimSummary = z.infer<typeof ClaimSummarySchema>;

// ===========================================================================
// Worklist (rows + response)
// ===========================================================================

export const WorklistRowSchema = z.object({
  claim: ClaimSummarySchema,
  classification: ClassificationSchema,
});
export type WorklistRow = z.infer<typeof WorklistRowSchema>;

export const WorklistResponseSchema = z.object({
  rows: z.array(WorklistRowSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  page_size: z.number().int().min(1),
  has_more: z.boolean(),
});
export type WorklistResponse = z.infer<typeof WorklistResponseSchema>;

// ===========================================================================
// Worklist filters — single-valued per backend route signature
// ===========================================================================

/**
 * GET /v1/claims/worklist query params.
 *
 * Backend takes a single value per filter dimension (not an array).
 * Field names match the actual route handler in main.py — note that
 * these differ from what the handoff doc lists. Trust this, not the doc.
 *
 * The backend imposes a fixed sort (state=recommended floats first, then
 * classified_at desc). There is NO sort_by / sort_dir query parameter.
 * Frontend grid does not expose sort UI.
 */
export const WorklistRequestSchema = z.object({
  state: ClassificationStateEnum.optional(),
  primary_category: z.string().optional(),
  recommended_owner: z.string().optional(),
  payer_name: z.string().optional(),
  min_amount_cents: z.number().int().min(0).optional(),
  age_bucket: z.string().optional(),
  requires_human_review: z.boolean().optional(),
  priority_chip: PriorityChipEnum.optional(),
  classification_source: ClassificationSourceEnum.optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(200).default(50),
});
export type WorklistRequest = z.infer<typeof WorklistRequestSchema>;

// ===========================================================================
// Action request/response bodies
// ===========================================================================

export const AcceptRequestSchema = z.object({
  notes: z.string().max(1000).optional(),
});
export type AcceptRequest = z.infer<typeof AcceptRequestSchema>;

export const OverrideRequestSchema = z.object({
  reason: OverrideReasonEnum,
  corrected_category: z.string().optional(),
  corrected_branch: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
export type OverrideRequest = z.infer<typeof OverrideRequestSchema>;

export const CompleteRequestSchema = z.object({
  notes: z.string().max(1000).optional(),
});
export type CompleteRequest = z.infer<typeof CompleteRequestSchema>;

/**
 * StateTransitionResponse — what accept/override/complete return.
 *
 * Note: backend returns a transition summary, NOT the updated Classification.
 * The FE must refetch the worklist (or the single classification) to see
 * the new state. The dispatcher's cache invalidation (denial.list tag)
 * handles this automatically when configured.
 */
export const StateTransitionResponseSchema = z.object({
  classification_id: z.string().uuid(),
  previous_state: ClassificationStateEnum,
  new_state: ClassificationStateEnum,
  transitioned_at: z.string(),
  transitioned_by_sub: z.string(),
});
export type StateTransitionResponse = z.infer<
  typeof StateTransitionResponseSchema
>;

// ===========================================================================
// Bulk-accept (D-19)
// ===========================================================================

export const BulkAcceptRequestSchema = z.object({
  classification_ids: z.array(z.string().uuid()).min(1).max(500),
  notes: z.string().max(1000).optional(),
});
export type BulkAcceptRequest = z.infer<typeof BulkAcceptRequestSchema>;

export const BulkAcceptRejectionSchema = z.object({
  classification_id: z.string().uuid(),
  reason: BulkAcceptRejectReasonEnum,
  detail: z.string(),
});
export type BulkAcceptRejection = z.infer<typeof BulkAcceptRejectionSchema>;

export const BulkAcceptResponseSchema = z.object({
  requested: z.number().int().min(0),
  accepted: z.array(z.string().uuid()),
  rejected: z.array(BulkAcceptRejectionSchema),
});
export type BulkAcceptResponse = z.infer<typeof BulkAcceptResponseSchema>;

// ===========================================================================
// Cost monitoring (new in PR-4 — backend ships, FE never modeled)
// ===========================================================================

export const DailyCostRowSchema = z.object({
  date: z.string(), // ISO date
  num_llm_calls: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  total_cost_cents: z.number().int().min(0),
  total_cost_usd: DecimalStringSchema.default('0.00'),
});
export type DailyCostRow = z.infer<typeof DailyCostRowSchema>;

export const CostSummarySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  total_cost_cents: z.number().int().min(0),
  total_cost_usd: DecimalStringSchema,
  total_llm_calls: z.number().int().min(0),
  days: z.array(DailyCostRowSchema),
});
export type CostSummary = z.infer<typeof CostSummarySchema>;

export const CostQuerySchema = z.object({
  start_date: z.string().optional(), // ISO date
  end_date: z.string().optional(),
});
export type CostQuery = z.infer<typeof CostQuerySchema>;

// ===========================================================================
// Static enums — these don't come from a backend endpoint
// ===========================================================================

/**
 * 34 categories per the handoff doc. Backend rejects unknown values via
 * a Pydantic validator; we mirror the closed set here so the FE category
 * filter doesn't offer values the backend will reject.
 *
 * Distributed via the FE artifact rather than fetched from /facets
 * (which doesn't exist). This list updates when the Training Guide
 * version bumps — currently v3.0.
 */
export const CATEGORY_VALUES = [
  '00. NO ACTION NEEDED',
  '01. Posting / Payment misposted',
  '02. Wrong Payer / Misrouted',
  '03. Coding (no documentation needed)',
  '04. Coding (documentation needed) - Need to Refile',
  '05. Missing or Incorrect Info — Demographic',
  '06. Authorization / Pre-cert',
  '07. Referral Required',
  '08. Medical Necessity (Records Needed) — Need to Refile',
  '09. Eligibility — Patient Not Active',
  '10. Duplicate Claim',
  '11. Frequency / Timely Limit on Service',
  '12. Bundling / NCCI',
  '13. Modifier — Missing or Invalid',
  '14. Anesthesia Time / Units',
  '15. Coordination of Benefits (COB) — Other Payer Primary',
  '16. Patient Responsibility (Deductible / Copay / Coinsurance)',
  '17. Non-Covered Service',
  '18. Provider Not Enrolled',
  '19. Place of Service (POS) Invalid',
  '20. Provider Specialty Mismatch',
  '21. Diagnosis — Missing or Invalid',
  '22. Timely Filing — Initial Claim Past Limit',
  '23. Timely Filing — Appeal Past Limit',
  '24. Workers Comp / Auto / Third-Party Liability',
  '25. Out-of-Network',
  '26. Capitation',
  '27. Refund Request / Recoupment',
  '28. Pricing / Allowed Amount Dispute',
  '29. Bundling — Mutually Exclusive',
  '30. Information Request from Payer',
  '31. Provider Enrollment / Credentialing Lapse',
  '32. Other (rare; classifier escalates to human)',
  '99. Uncategorized',
] as const;
export type Category = (typeof CATEGORY_VALUES)[number];

/**
 * Override reason analyst-facing copy. Verbatim from the backend's
 * OverrideReason enum docstring. Handoff doc says to surface this
 * language exactly — do not paraphrase.
 */
export const OVERRIDE_REASON_COPY: Record<
  OverrideReason,
  { label: string; description: string; requiresCategory: boolean }
> = {
  tool_wrong: {
    label: 'Tool is wrong',
    description:
      'The category the tool picked is wrong. (Rules/prompt tuning signal.)',
    requiresCategory: true,
  },
  tool_right_but_alternate_path: {
    label: 'Tool right, alternate path',
    description:
      "Category is correct but I'm taking a different remediation path than the suggested workflow steps. (Workflow refinement signal.)",
    requiresCategory: false,
  },
  edge_case: {
    label: 'Edge case',
    description:
      "The case doesn't fit any existing rule cleanly — the tool's rules need to learn this pattern. (Coverage gap signal.)",
    requiresCategory: false,
  },
  data_error: {
    label: 'Data error',
    description:
      "Bad input data prevented correct classification (missing CARC codes, garbled denial reason, etc.). Not the tool's fault.",
    requiresCategory: false,
  },
  worked_outside_tool: {
    label: 'Worked outside tool',
    description:
      "The tool's classification looks fine, but the claim was already worked outside the tool (analyst clarified it directly, hit STATUS=11/12/13 before our cron ran). Recording this helps measure process gaps — how often denials bypass the tool.",
    requiresCategory: false,
  },
};
