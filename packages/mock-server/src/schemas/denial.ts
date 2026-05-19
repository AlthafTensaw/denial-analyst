/**
 * Denial Tool — Zod schemas (PR-5 update for Phase 1.5 surfaces).
 *
 * This file FULLY REPLACES the PR-4 schemas/denial.ts. Adds Day-13 +
 * Day-14 endpoint shapes and updates WorkflowStep with completion fields.
 *
 * Phase 1.5 additions:
 *   - WorkflowStep: completed_at + completed_by (nullable, populated after
 *     POST /v1/classifications/{id}/steps/{n}/complete)
 *   - ClaimDetail (fat-row claim shape for the row-expand panel)
 *   - DenialEvent + DenialEventCode (source-evidence region payload)
 *   - StepCompletionRequest/Response (per-step checkbox flow)
 *   - RevealPhiRequest/Response (PHI reveal audit endpoint, now wired)
 *
 * Everything else is unchanged from PR-4 — UUID identifiers, decimal-
 * string money, bare-payload wire, 6 PriorityChip + 5 OverrideReason
 * + 34 CATEGORY_VALUES, single-valued worklist filters, fixed sort.
 *
 * Backend handoff doc note: it mentions `state_updated_at` on Classification
 * (handoff doc line 539) but the OpenAPI still does NOT expose it (Day 14).
 * Continue to not model it; flagged in BACKEND_HANDBACK §1 for cleanup.
 */

import { z } from 'zod';

// ===========================================================================
// Enums (unchanged from PR-4)
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

export const PriorityChipEnum = z.enum([
  'HIGH_DOLLAR',
  'LOW_CONFIDENCE',
  'DUP_INVESTIGATE',
  'TF_WATCH',
  'OVERRIDE_PATTERN',
  'DATA_ERROR',
]);
export type PriorityChip = z.infer<typeof PriorityChipEnum>;

export const AgingBucketEnum = z.enum([
  '0-29 day',
  '30-59 day',
  '60-89 day',
  '90-119 day',
  '120-179 day',
  '180+ day',
]);
export type AgingBucket = z.infer<typeof AgingBucketEnum>;

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
// Money — Decimal-as-string (unchanged)
// ===========================================================================

export const DecimalStringSchema = z
  .string()
  .regex(/^(?!^[-+.]*$)[+-]?0*\d*\.?\d*$/);

// ===========================================================================
// Workflow step — PR-5 additions: completed_at + completed_by
// ===========================================================================

export const WorkflowStepSchema = z.object({
  step: z.number().int().min(1),
  action: z.string(),
  owner: z.string(),
  sla_days: z.number().int().min(0),
  mode: z.string().default('Manual'),
  day: z.string().nullable().optional(),
  // Phase 1.5: populated after POST /steps/{n}/complete; null otherwise.
  completed_at: z.string().nullable().optional(),
  completed_by: z.string().nullable().optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ===========================================================================
// Classification (unchanged from PR-4)
// ===========================================================================

export const ClassificationSchema = z.object({
  classification_id: z.string().uuid(),
  claim_id: z.number().int(),
  classified_at: z.string(),
  tool_version: z.string(),
  training_guide_version: z.string(),
  primary_category: z.string(),
  training_guide_section: z.string().nullable(),
  alternate_categories: z.array(z.string()).default([]),
  classification_source: ClassificationSourceEnum,
  rule_id: z.string().nullable(),
  confidence: ConfidenceEnum,
  workflow_steps: z.array(WorkflowStepSchema).default([]),
  branch_chosen: z.string().nullable(),
  recommended_owner: z.string(),
  sla_next_action_date: z.string(),
  priority_chips: z.array(PriorityChipEnum).default([]),
  risk_flags: z.array(z.string()).default([]),
  requires_human_review: z.boolean(),
  reasoning_summary: z.string(),
  state: ClassificationStateEnum.default('recommended'),
});
export type Classification = z.infer<typeof ClassificationSchema>;

// ===========================================================================
// Claim shapes — Summary (worklist row) vs Detail (row-expand fetch)
// ===========================================================================

export const ClaimSummarySchema = z.object({
  claim_id: z.number().int(),
  clinic: z.string().nullable(),
  primary_payer_name: z.string().nullable(),
  dos: z.string(),
  amount: DecimalStringSchema,
  net_pending: DecimalStringSchema,
  aging_bucket: z.string().nullable(),
  cpt_lines: z.array(z.string()).default([]),
  appeal_status: z.string().nullable(),
  current_status_code: z.number().int().nullable().default(null),
  current_status_label: z.string().nullable().default(null),
});
export type ClaimSummary = z.infer<typeof ClaimSummarySchema>;

/**
 * ClaimDetail — fat-row claim payload fetched on row-expand.
 *
 * Phase 1.5 addition. Returned by GET /v1/claims/{claim_id}. Adds
 * patient (PHI), provider/facility, full financial breakdown (4 paid
 * buckets + 3 pending buckets + net_pending), ICD codes.
 *
 * patient_name and mrn are PHI — wrap in <PrivacyField> and fire
 * reveal-phi on click. field_path conventions: "claim.patient_name" / "claim.mrn".
 */
export const ClaimDetailSchema = z.object({
  claim_id: z.number().int(),
  clinic_id: z.number().int(),
  clinic_alias: z.string(),
  clinic_name: z.string(),

  dos: z.string().nullable(),
  primary_payer_name: z.string().nullable(),
  appeal_status: z.string().nullable(),
  current_status_code: z.number().int(),
  current_status_label: z.string(),
  aging_bucket: z.string().nullable(),

  patient_name: z.string().nullable(),
  mrn: z.string().nullable(),

  provider_name: z.string().nullable(),
  rendering_provider_name: z.string().nullable(),
  facility_id: z.number().int().nullable(),
  facility_name: z.string().nullable(),

  billed: DecimalStringSchema.nullable(),
  primary_paid: DecimalStringSchema.nullable(),
  secondary_paid: DecimalStringSchema.nullable(),
  tertiary_paid: DecimalStringSchema.nullable(),
  patient_paid: DecimalStringSchema.nullable(),
  primary_pending: DecimalStringSchema.nullable(),
  secondary_pending: DecimalStringSchema.nullable(),
  patient_pending: DecimalStringSchema.nullable(),
  net_pending: DecimalStringSchema.nullable(),

  cpt_lines: z.array(z.string()).default([]),
  icd_codes: z.array(z.string()).default([]),
});
export type ClaimDetail = z.infer<typeof ClaimDetailSchema>;

// ===========================================================================
// Denial events — source-evidence region (Day-13 endpoint, now wired)
// ===========================================================================

/**
 * One CARC or RARC code attached to a denial event.
 *
 * Backend splits the single Primrose CODE column into carc_codes vs
 * rarc_codes on output:
 *   - RARC: codes starting with M or N (e.g., 'M1', 'N418', 'MA01')
 *   - CARC: everything else (e.g., 'CO-109', '18', 'PR-1')
 *
 * `reason_text` is PHI-bearing — wrap in PrivacyField, audit reveal via
 * /reveal-phi with field_path = `denial_event:{event_id}.{carc|rarc}.{code}.reason_text`.
 */
export const DenialEventCodeSchema = z.object({
  code: z.string(),
  reason_text: z.string(),
});
export type DenialEventCode = z.infer<typeof DenialEventCodeSchema>;

export const DenialEventSchema = z.object({
  event_id: z.number().int(),
  occurred_at: z.string().nullable(),
  procedure_id: z.number().int(),
  procedure_code: z.string().nullable(),
  carc_codes: z.array(DenialEventCodeSchema).default([]),
  rarc_codes: z.array(DenialEventCodeSchema).default([]),
  is_deleted: z.boolean(),
});
export type DenialEvent = z.infer<typeof DenialEventSchema>;

// GET /v1/claims/{claim_id}/denial-events returns a bare array.
export const DenialEventListSchema = z.array(DenialEventSchema);

// ===========================================================================
// Worklist (unchanged)
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
// Action request/response bodies (unchanged)
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
// Phase 1.5: Per-step completion
// ===========================================================================

export const StepCompletionRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});
export type StepCompletionRequest = z.infer<typeof StepCompletionRequestSchema>;

/**
 * StepCompletionResponse.
 *
 * - `next_step_number`: highlight as new "current" focus; null = no more
 * - `all_steps_completed`: convenience flag derived from workflow
 * - `auto_completed_classification`: true when backend auto-flipped state
 *   to 'completed' (only fires when state was accepted/overridden + last
 *   step was just completed). FE refreshes local state on true.
 *
 * Idempotency: re-POSTing the same (classification_id, step_number)
 * returns the original completion timestamp, not an error.
 */
export const StepCompletionResponseSchema = z.object({
  classification_id: z.string().uuid(),
  step_number: z.number().int().min(1),
  completed_at: z.string(),
  completed_by: z.string(),
  next_step_number: z.number().int().nullable(),
  all_steps_completed: z.boolean(),
  auto_completed_classification: z.boolean(),
});
export type StepCompletionResponse = z.infer<
  typeof StepCompletionResponseSchema
>;

// ===========================================================================
// Phase 1.5: PHI reveal audit
// ===========================================================================

/**
 * POST /v1/classifications/{id}/reveal-phi body.
 *
 * Fire-and-forget audit. HIPAA minimum-necessary requires server log
 * regardless of UI state.
 *
 * field_path conventions (see PrivacyField for usage; FE inlines these):
 *   - "claim.patient_name"
 *   - "claim.mrn"
 *   - "denial_event:{event_id}.carc.{code}.reason_text"
 *   - "denial_event:{event_id}.rarc.{code}.reason_text"
 *
 * purpose: free-text on the wire, FE-consistent strings:
 *   "worklist_review" | "override_validation" | "appeal_drafting" | "audit_response"
 */
/**
 * RevealPhi purposes — free-text on the wire (backend doesn't validate
 * a closed set), but FE-side we want consistency so audit reports
 * aggregate cleanly. Keep this list aligned with the handoff doc's
 * recommended values:
 *   - "worklist_review"     — analyst inspecting a row (most common)
 *   - "override_validation" — analyst validating before overriding
 *   - "appeal_drafting"     — preparing an appeal letter
 *   - "audit_response"      — responding to compliance audit
 *
 * If a future surface needs a new purpose, add it here rather than
 * inlining the string at the call site.
 */
export const RevealPhiPurposeEnum = z.enum([
  'worklist_review',
  'override_validation',
  'appeal_drafting',
  'audit_response',
]);
export type RevealPhiPurpose = z.infer<typeof RevealPhiPurposeEnum>;

export const RevealPhiRequestSchema = z.object({
  field_path: z.string().max(200),
  // Wire schema accepts any string; we ship the FE-side enum separately
  // so components type-check against the curated list while preserving
  // forward compat if the backend ever rejects unknowns.
  purpose: z.string().max(80),
  notes: z.string().max(500).optional(),
});
export type RevealPhiRequest = z.infer<typeof RevealPhiRequestSchema>;

export const RevealPhiResponseSchema = z.object({
  audit_event_id: z.string().uuid(),
  recorded_at: z.string(),
});
export type RevealPhiResponse = z.infer<typeof RevealPhiResponseSchema>;

// ===========================================================================
// Cost monitoring (unchanged)
// ===========================================================================

export const DailyCostRowSchema = z.object({
  date: z.string(),
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
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});
export type CostQuery = z.infer<typeof CostQuerySchema>;

// ===========================================================================
// Static enums (unchanged)
// ===========================================================================

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
