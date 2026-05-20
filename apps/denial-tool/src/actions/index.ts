/**
 * Denial Tool — actions registry (PR-5).
 *
 * 12 actions total. PR-4 had 8 (list, detail, accept, override, complete,
 * bulk-accept, classify-claim, cost-daily). PR-5 adds 4:
 *
 *   - denial.claim-detail       GET  /v1/claims/{claim_id}
 *   - denial.denial-events      GET  /v1/claims/{claim_id}/denial-events
 *   - denial.step-complete      POST /v1/classifications/{id}/steps/{n}/complete
 *   - denial.reveal-phi         POST /v1/classifications/{id}/reveal-phi
 *
 * Permission scheme unchanged:
 *   denial.read              : list / detail / claim-detail / denial-events / cost
 *   denial.act               : accept / override / complete / bulk-accept / step-complete / reveal-phi
 *   denial.classify_claim    : per-claim re-classify (MANAGER + ADMIN)
 *   denial.view_cost         : cost-daily (MANAGER + ADMIN)
 *
 * Cache tagging: step-complete and reveal-phi invalidate the right tags
 * so the worklist + detail panel both refresh after a mutation. Step
 * completion can auto-transition the classification state, so it MUST
 * invalidate the worklist (the row's `state` may have changed).
 */

import { z } from 'zod';
import { defineAction } from '@tensaw/actions';

import {
  AcceptRequestSchema,
  BulkAcceptRequestSchema,
  BulkAcceptResponseSchema,
  ClaimDetailSchema,
  ClassificationSchema,
  CompleteRequestSchema,
  CostQuerySchema,
  CostSummarySchema,
  DenialEventSchema,
  OverrideRequestSchema,
  RevealPhiRequestSchema,
  RevealPhiResponseSchema,
  StateTransitionResponseSchema,
  StepCompletionRequestSchema,
  StepCompletionResponseSchema,
  WorklistRequestSchema,
  WorklistResponseSchema,
} from './schemas';

let registered = false;

export function registerDenialActions(): void {
  if (registered) return;
  registered = true;

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  defineAction({
    actionId: 'denial.list',
    kind: 'query',
    endpoint: 'GET /v1/claims/worklist',
    permission: 'denial.read',
    description:
      'Paginated worklist of claims + classifications. Single-valued filters. Fixed server-side sort.',
    request: WorklistRequestSchema,
    response: WorklistResponseSchema,
    cache: {
      tag: 'worklist',
      invalidatedBy: [
        'denial.accept',
        'denial.override',
        'denial.complete',
        'denial.bulk-accept',
        'denial.classify-claim',
        'denial.step-complete', // PR-5: step completion can auto-transition state
      ],
    },
  });

  defineAction({
    actionId: 'denial.detail',
    kind: 'query',
    endpoint: 'GET /v1/classifications/{classification_id}',
    permission: 'denial.read',
    description: 'Fetch a single classification by id.',
    request: z.object({
      classification_id: z.string().uuid(),
    }),
    response: ClassificationSchema,
    cache: {
      tag: 'classification-detail',
      invalidatedBy: [
        'denial.accept',
        'denial.override',
        'denial.complete',
        'denial.step-complete', // PR-5: refresh per-step completion state
      ],
    },
  });

  // PR-5 NEW: fat claim detail (patient, provider, financial breakdown, ICDs)
  defineAction({
    actionId: 'denial.claim-detail',
    kind: 'query',
    endpoint: 'GET /v1/claims/{claim_id}',
    permission: 'denial.read',
    description:
      "Fat claim-detail for the row-expand panel. Returns patient (PHI), provider, facility, financial breakdown (billed + 4 paid + 3 pending + net_pending), and ICD codes. Distinct from the worklist's thin ClaimSummary (D-17 single-line density).",
    request: z.object({ claim_id: z.number().int().positive() }),
    response: ClaimDetailSchema,
    cache: {
      tag: 'claim-detail',
      invalidatedBy: [], // Claim attributes don't change in response to FE actions
    },
  });

  // PR-5 NEW: denial-event source evidence (the §6.6 region 2 data)
  defineAction({
    actionId: 'denial.denial-events',
    kind: 'query',
    endpoint: 'GET /v1/claims/{claim_id}/denial-events',
    permission: 'denial.read',
    description:
      "Denial-event history with CARC + RARC codes and reason_text per event. The source-evidence region of the detail panel renders this. `reason_text` is PHI — wrap in <PrivacyField>.",
    request: z.object({ claim_id: z.number().int().positive() }),
    response: z.array(DenialEventSchema),
    cache: {
      tag: 'denial-events',
      invalidatedBy: [],
    },
  });

  defineAction({
    actionId: 'denial.cost-daily',
    kind: 'query',
    endpoint: 'GET /v1/cost/daily',
    permission: 'denial.view_cost',
    description: 'Daily LLM-cost aggregates. Defaults to last 30 days; max window 90 days.',
    request: CostQuerySchema,
    response: CostSummarySchema,
    cache: { tag: 'cost-daily', invalidatedBy: [] },
  });

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  defineAction({
    actionId: 'denial.accept',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/{classification_id}/accept',
    permission: 'denial.act',
    description:
      "Single accept. Returns StateTransitionResponse — caller must refetch the worklist to see the new state.",
    request: AcceptRequestSchema.extend({
      classification_id: z.string().uuid(),
    }),
    response: StateTransitionResponseSchema,
  });

  defineAction({
    actionId: 'denial.override',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/{classification_id}/override',
    permission: 'denial.act',
    description: "Single override. 5 reasons incl. worked_outside_tool.",
    request: OverrideRequestSchema.extend({
      classification_id: z.string().uuid(),
    }),
    response: StateTransitionResponseSchema,
  });

  defineAction({
    actionId: 'denial.complete',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/{classification_id}/complete',
    permission: 'denial.act',
    description:
      "Mark as completed. Only valid from state=accepted | overridden. 409 INVALID_STATE_TRANSITION otherwise. PR-5: now exposed in the normal action flow via the Complete button on accepted/overridden rows.",
    request: CompleteRequestSchema.extend({
      classification_id: z.string().uuid(),
    }),
    response: StateTransitionResponseSchema,
  });

  // PR-5 NEW: per-step completion (Phase 1.5)
  defineAction({
    actionId: 'denial.step-complete',
    kind: 'mutation',
    endpoint:
      'POST /v1/classifications/{classification_id}/steps/{step_number}/complete',
    permission: 'denial.act',
    description:
      "Mark a single workflow step complete. Idempotent — re-calling with the same (classification_id, step_number) is a no-op that returns the original timestamp. Response carries next_step_number for current-step highlighting and auto_completed_classification when the step closes out a workflow on an accepted/overridden classification (state auto-transitions to completed). Returns 201, not 200.",
    request: StepCompletionRequestSchema.extend({
      classification_id: z.string().uuid(),
      step_number: z.number().int().min(1),
    }),
    response: StepCompletionResponseSchema,
  });

  defineAction({
    actionId: 'denial.bulk-accept',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/bulk-accept',
    permission: 'denial.act',
    description: "Bulk accept with D-19 strict gate.",
    request: BulkAcceptRequestSchema,
    response: BulkAcceptResponseSchema,
  });

  defineAction({
    actionId: 'denial.classify-claim',
    kind: 'mutation',
    endpoint: 'POST /v1/claims/{claim_id}/classify',
    permission: 'denial.classify_claim',
    description: "Per-claim ad-hoc classify (MANAGER + ADMIN only, D-18).",
    request: z.object({ claim_id: z.number().int().positive() }),
    response: ClassificationSchema,
  });

  // PR-5 NEW: reveal-phi audit (fire-and-forget)
  defineAction({
    actionId: 'denial.reveal-phi',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/{classification_id}/reveal-phi',
    permission: 'denial.act',
    description:
      "Audit event when an analyst reveals a PHI-bearing field. HIPAA minimum-necessary requires the server-side log. FE treats as fire-and-forget — does NOT gate the reveal on call success (would block the analyst when the audit endpoint is degraded). The mutation logs failure but resolves successfully from the UX standpoint.",
    request: RevealPhiRequestSchema.extend({
      classification_id: z.string().uuid(),
    }),
    response: RevealPhiResponseSchema,
  });
}
