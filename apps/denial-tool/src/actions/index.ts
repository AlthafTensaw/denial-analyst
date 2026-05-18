/**
 * Denial Tool — actions registry (PR-4 rewrite).
 *
 * 8 actions matching the live backend exactly. Removed from PR-3:
 *   - denial.facets             (no endpoint exists)
 *   - denial.latest-run         (no endpoint exists)
 *   - denial.bulk-override      (no endpoint exists)
 *   - denial.export             (no endpoint exists; replaced w/ client-side CSV)
 *   - denial.reveal-phi         (no endpoint exists)
 *
 * Renamed:
 *   - denial.run → denial.classify-claim (per-claim only, manager+ only per D-18)
 *
 * Added:
 *   - denial.cost-daily         (Phase 1 manager-facing scope, was missing)
 *
 * Permission scheme:
 *   - denial.read              : worklist + detail + classify result viewing
 *   - denial.act               : accept / override / complete / bulk-accept
 *   - denial.classify_claim    : POST /v1/claims/{id}/classify (MANAGER + ADMIN per D-18)
 *   - denial.view_cost         : GET /v1/cost/daily (MANAGER + ADMIN)
 *
 * Cache tagging:
 *   - Read actions tag their results so write actions can invalidate.
 *   - The worklist + per-row detail share the 'worklist' tag because the
 *     backend's transition responses don't return the updated row — the
 *     FE must refetch after every mutation.
 */

import { z } from 'zod';
import { defineAction } from '@tensaw/actions';

import {
  AcceptRequestSchema,
  BulkAcceptRequestSchema,
  BulkAcceptResponseSchema,
  ClassificationSchema,
  CompleteRequestSchema,
  CostQuerySchema,
  CostSummarySchema,
  OverrideRequestSchema,
  StateTransitionResponseSchema,
  WorklistRequestSchema,
  WorklistResponseSchema,
} from './schemas';

let registered = false;

/**
 * Register all Denial Tool actions. Called once from bootstrap.ts.
 * Idempotent — repeated calls are no-ops so HMR-driven re-mounts don't
 * throw on duplicate-id.
 */
export function registerDenialActions(): void {
  if (registered) return;
  registered = true;

  // =========================================================================
  // QUERIES
  // =========================================================================

  // GET /v1/claims/worklist
  defineAction({
    actionId: 'denial.list',
    kind: 'query',
    endpoint: 'GET /v1/claims/worklist',
    permission: 'denial.read',
    description:
      'Paginated worklist of claims + classifications. Single-valued filters per backend route signature. Sort is fixed server-side: state=recommended floats to the top, then classified_at desc within each state bucket.',
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
      ],
    },
  });

  // GET /v1/classifications/{classification_id}
  defineAction({
    actionId: 'denial.detail',
    kind: 'query',
    endpoint: 'GET /v1/classifications/{classification_id}',
    permission: 'denial.read',
    description:
      'Fetch a single classification by id. Note: backend returns Classification only — no claim or denial-event history. The worklist already carries ClaimSummary, so the FE renders source-evidence from what it has.',
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
      ],
    },
  });

  // GET /v1/cost/daily
  defineAction({
    actionId: 'denial.cost-daily',
    kind: 'query',
    endpoint: 'GET /v1/cost/daily',
    permission: 'denial.view_cost',
    description:
      "Daily LLM-cost aggregates. Defaults to last 30 days; max window 90 days (422 otherwise). Returns one row per day in the window, zero-filled — plot as a continuous time series without gap-filling on the client.",
    request: CostQuerySchema,
    response: CostSummarySchema,
    cache: {
      tag: 'cost-daily',
      // Cost doesn't change in response to user mutations.
      invalidatedBy: [],
    },
  });

  // =========================================================================
  // MUTATIONS
  // =========================================================================

  // POST /v1/classifications/{classification_id}/accept
  defineAction({
    actionId: 'denial.accept',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/{classification_id}/accept',
    permission: 'denial.act',
    description:
      "Single accept. Returns StateTransitionResponse — caller must refetch the worklist to see the new state (the response doesn't include the updated row).",
    request: AcceptRequestSchema.extend({
      classification_id: z.string().uuid(),
    }),
    response: StateTransitionResponseSchema,
  });

  // POST /v1/classifications/{classification_id}/override
  defineAction({
    actionId: 'denial.override',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/{classification_id}/override',
    permission: 'denial.act',
    description:
      "Single override. reason ∈ D-05 + D-08 enum (5 values incl. worked_outside_tool). corrected_category + corrected_branch optional but recommended for tool_wrong / tool_right_but_alternate_path. Notes optional.",
    request: OverrideRequestSchema.extend({
      classification_id: z.string().uuid(),
    }),
    response: StateTransitionResponseSchema,
  });

  // POST /v1/classifications/{classification_id}/complete
  defineAction({
    actionId: 'denial.complete',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/{classification_id}/complete',
    permission: 'denial.act',
    description:
      "Mark as completed. Only valid from state=accepted | overridden — 409 INVALID_STATE_TRANSITION otherwise.",
    request: CompleteRequestSchema.extend({
      classification_id: z.string().uuid(),
    }),
    response: StateTransitionResponseSchema,
  });

  // POST /v1/classifications/bulk-accept
  defineAction({
    actionId: 'denial.bulk-accept',
    kind: 'mutation',
    endpoint: 'POST /v1/classifications/bulk-accept',
    permission: 'denial.act',
    description:
      "Bulk accept with D-19 strict gate (LOW_CONFIDENCE + REQUIRES_HUMAN_REVIEW + INVALID_STATE re-checked server-side). Returns { requested, accepted: UUID[], rejected: { classification_id, reason, detail }[] }. UI surfaces partial-success per Q#11.",
    request: BulkAcceptRequestSchema,
    response: BulkAcceptResponseSchema,
  });

  // POST /v1/claims/{claim_id}/classify
  defineAction({
    actionId: 'denial.classify-claim',
    kind: 'mutation',
    endpoint: 'POST /v1/claims/{claim_id}/classify',
    permission: 'denial.classify_claim',
    description:
      "Per-claim ad-hoc classify (D-18, MANAGER + ADMIN only). Re-runs the classifier against the current denial events on the claim. Returns the new Classification. 422 if the claim has no denial events.",
    request: z.object({ claim_id: z.number().int().positive() }),
    response: ClassificationSchema,
  });
}
