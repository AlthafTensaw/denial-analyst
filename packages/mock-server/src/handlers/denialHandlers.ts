/**
 * Denial Tool — MSW handlers (PR-5).
 *
 * 12 endpoints matching the live Day-14 backend (14 OpenAPI paths minus
 * /healthz and /readyz which aren't UI surfaces).
 *
 * PR-5 additions over PR-4:
 *   - POST /v1/classifications/{id}/steps/{step_number}/complete
 *     (returns 201, not 200 — per OpenAPI; auto-transitions classification
 *     to `completed` when the last step closes out and current state is
 *     accepted/overridden)
 *   - GET /v1/claims/{claim_id}
 *     (fat claim-detail with patient PHI + financial breakdown)
 *   - GET /v1/claims/{claim_id}/denial-events
 *     (CARC + RARC histories; reason_text is PHI)
 *   - POST /v1/classifications/{id}/reveal-phi
 *     (fire-and-forget audit confirmation; returns audit_event_id)
 *
 * All other endpoints unchanged from PR-4.
 */

import { http, HttpResponse } from 'msw';

import {
  AcceptRequestSchema,
  BulkAcceptRequestSchema,
  CompleteRequestSchema,
  CostQuerySchema,
  OverrideRequestSchema,
  RevealPhiRequestSchema,
  StepCompletionRequestSchema,
  WorklistRequestSchema,
  type BulkAcceptResponse,
  type Classification,
  type StateTransitionResponse,
  type StepCompletionResponse,
  type WorklistRow,
} from '../schemas/denial';
import {
  appendAudit,
  appendRevealAudit,
  completeStep,
  findRow,
  listRows,
  patchClassification,
} from './denialState';
import { buildCostSummary } from '../fixtures/denial/costDaily';
import { findClaimDetail } from '../fixtures/denial/claimDetails';
import { findDenialEvents } from '../fixtures/denial/denialEvents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  error_code: string;
  correlation_id: string;
  [key: string]: unknown;
}

function problem(
  status: number,
  errorCode: string,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
): HttpResponse {
  const body: ProblemBody = {
    type: 'about:blank',
    title,
    status,
    detail,
    error_code: errorCode,
    correlation_id: '01HMOCK' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    ...extra,
  };
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

const ANALYST_SUB = 'mock-analyst-sub-renita-k';
const ANALYST_USERNAME = 'renita.scott';

function applyFixedSort(rows: WorklistRow[]): WorklistRow[] {
  const STATE_ORDER: Record<Classification['state'], number> = {
    recommended: 0,
    accepted: 1,
    overridden: 2,
    completed: 3,
  };
  return [...rows].sort((a, b) => {
    const sa = STATE_ORDER[a.classification.state];
    const sb = STATE_ORDER[b.classification.state];
    if (sa !== sb) return sa - sb;
    return (
      new Date(b.classification.classified_at).getTime() -
      new Date(a.classification.classified_at).getTime()
    );
  });
}

function applyFilters(
  rows: WorklistRow[],
  req: ReturnType<typeof WorklistRequestSchema.parse>,
): WorklistRow[] {
  let out = rows;
  if (req.state !== undefined)
    out = out.filter((r) => r.classification.state === req.state);
  if (req.primary_category !== undefined)
    out = out.filter(
      (r) => r.classification.primary_category === req.primary_category,
    );
  if (req.recommended_owner !== undefined)
    out = out.filter(
      (r) => r.classification.recommended_owner === req.recommended_owner,
    );
  if (req.payer_name !== undefined)
    out = out.filter((r) => r.claim.primary_payer_name === req.payer_name);
  if (req.min_amount_cents !== undefined)
    out = out.filter(
      (r) => Math.round(Number(r.claim.net_pending) * 100) >= req.min_amount_cents!,
    );
  if (req.age_bucket !== undefined)
    out = out.filter((r) => r.claim.aging_bucket === req.age_bucket);
  if (req.requires_human_review !== undefined)
    out = out.filter(
      (r) =>
        r.classification.requires_human_review === req.requires_human_review,
    );
  if (req.priority_chip !== undefined)
    out = out.filter((r) =>
      r.classification.priority_chips.includes(req.priority_chip!),
    );
  if (req.classification_source !== undefined)
    out = out.filter(
      (r) => r.classification.classification_source === req.classification_source,
    );
  return out;
}

function transitionResponse(
  classificationId: string,
  prev: Classification['state'],
  next: Classification['state'],
): StateTransitionResponse {
  return {
    classification_id: classificationId,
    previous_state: prev,
    new_state: next,
    transitioned_at: new Date().toISOString(),
    transitioned_by_sub: ANALYST_SUB,
  };
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

export function buildDenialHandlers(baseUrl: string) {
  const u = (path: string) => `${baseUrl}${path}`;

  return [
    // ============================================================ LIST
    http.get(u('/v1/claims/worklist'), ({ request }) => {
      const url = new URL(request.url);
      const params: Record<string, unknown> = {};
      const single = (k: string) => {
        const v = url.searchParams.get(k);
        if (v !== null) params[k] = v;
      };
      single('state');
      single('primary_category');
      single('recommended_owner');
      single('payer_name');
      single('age_bucket');
      single('priority_chip');
      single('classification_source');
      const minAmount = url.searchParams.get('min_amount_cents');
      if (minAmount !== null) params.min_amount_cents = Number(minAmount);
      const requiresReview = url.searchParams.get('requires_human_review');
      if (requiresReview !== null)
        params.requires_human_review = requiresReview === 'true';
      const page = url.searchParams.get('page');
      if (page !== null) params.page = Number(page);
      const pageSize = url.searchParams.get('page_size');
      if (pageSize !== null) params.page_size = Number(pageSize);

      const parsed = WorklistRequestSchema.safeParse(params);
      if (!parsed.success) {
        return problem(
          422,
          'VALIDATION_ERROR',
          'Validation error',
          'Invalid query parameters',
          { errors: parsed.error.format() },
        );
      }
      const req = parsed.data;
      const filtered = applyFilters(listRows(), req);
      const sorted = applyFixedSort(filtered);
      const total = sorted.length;
      const start = (req.page - 1) * req.page_size;
      const paged = sorted.slice(start, start + req.page_size);
      return HttpResponse.json({
        rows: paged,
        total,
        page: req.page,
        page_size: req.page_size,
        has_more: start + paged.length < total,
      });
    }),

    // ============================================================ CLASSIFICATION DETAIL
    http.get(u('/v1/classifications/:classification_id'), ({ params }) => {
      const id = String(params.classification_id);
      const row = findRow(id);
      if (!row) {
        return problem(
          404,
          'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND',
          'Classification not found',
          `Classification not found: ${id}`,
          { classification_id: id },
        );
      }
      return HttpResponse.json(row.classification);
    }),

    // ============================================================ CLAIM DETAIL (PHASE 1.5)
    http.get(u('/v1/claims/:claim_id'), ({ params }) => {
      const claimIdNum = Number(params.claim_id);
      if (!Number.isFinite(claimIdNum) || claimIdNum <= 0) {
        return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid claim_id');
      }
      const detail = findClaimDetail(claimIdNum);
      if (!detail) {
        return problem(
          404,
          'DENIAL_TOOL_CLAIM_DETAIL_NOT_FOUND',
          'Claim not found',
          `Claim ${claimIdNum} not found.`,
          { claim_id: claimIdNum },
        );
      }
      return HttpResponse.json(detail);
    }),

    // ============================================================ DENIAL EVENTS (Day 13)
    http.get(u('/v1/claims/:claim_id/denial-events'), ({ params }) => {
      const claimIdNum = Number(params.claim_id);
      if (!Number.isFinite(claimIdNum) || claimIdNum <= 0) {
        return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid claim_id');
      }
      const events = findDenialEvents(claimIdNum);
      // Backend returns 422 when claim exists but has no denial events
      if (events.length === 0) {
        // Distinguish between unknown claim and no events
        const exists = findClaimDetail(claimIdNum) !== null;
        if (!exists) {
          return problem(
            404,
            'DENIAL_TOOL_CLAIM_NOT_FOUND',
            'Claim not found',
            `Claim ${claimIdNum} not found.`,
            { claim_id: claimIdNum },
          );
        }
        return problem(
          422,
          'DENIAL_TOOL_CLAIM_HAS_NO_DENIAL_EVENTS',
          'No denial events',
          `Claim ${claimIdNum} has no denial events.`,
          { claim_id: claimIdNum },
        );
      }
      return HttpResponse.json(events);
    }),

    // ============================================================ ACCEPT
    http.post(
      u('/v1/classifications/:classification_id/accept'),
      async ({ params, request }) => {
        const id = String(params.classification_id);
        const body = await request.json().catch(() => ({}));
        const parsed = AcceptRequestSchema.safeParse(body);
        if (!parsed.success) {
          return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid body');
        }
        const row = findRow(id);
        if (!row) {
          return problem(
            404,
            'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND',
            'Classification not found',
            `Classification not found: ${id}`,
            { classification_id: id },
          );
        }
        if (row.classification.state !== 'recommended') {
          return problem(
            409,
            'INVALID_STATE_TRANSITION',
            'Invalid state transition',
            `Cannot accept classification in state '${row.classification.state}'.`,
            { classification_id: id, current_state: row.classification.state },
          );
        }
        const prev = row.classification.state;
        patchClassification(id, { state: 'accepted' });
        appendAudit({
          classification_id: id,
          previous_state: prev,
          new_state: 'accepted',
          transitioned_at: new Date().toISOString(),
          transitioned_by_sub: ANALYST_SUB,
          notes: parsed.data.notes,
        });
        return HttpResponse.json(transitionResponse(id, prev, 'accepted'));
      },
    ),

    // ============================================================ OVERRIDE
    http.post(
      u('/v1/classifications/:classification_id/override'),
      async ({ params, request }) => {
        const id = String(params.classification_id);
        const body = await request.json().catch(() => ({}));
        const parsed = OverrideRequestSchema.safeParse(body);
        if (!parsed.success) {
          return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid body');
        }
        const row = findRow(id);
        if (!row) {
          return problem(
            404,
            'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND',
            'Classification not found',
            `Classification not found: ${id}`,
            { classification_id: id },
          );
        }
        if (row.classification.state !== 'recommended') {
          return problem(
            409,
            'INVALID_STATE_TRANSITION',
            'Invalid state transition',
            `Cannot override classification in state '${row.classification.state}'.`,
            { classification_id: id, current_state: row.classification.state },
          );
        }
        const prev = row.classification.state;
        patchClassification(id, { state: 'overridden' });
        appendAudit({
          classification_id: id,
          previous_state: prev,
          new_state: 'overridden',
          transitioned_at: new Date().toISOString(),
          transitioned_by_sub: ANALYST_SUB,
          reason: parsed.data.reason,
          corrected_category: parsed.data.corrected_category,
          corrected_branch: parsed.data.corrected_branch,
          notes: parsed.data.notes,
        });
        return HttpResponse.json(transitionResponse(id, prev, 'overridden'));
      },
    ),

    // ============================================================ COMPLETE
    http.post(
      u('/v1/classifications/:classification_id/complete'),
      async ({ params, request }) => {
        const id = String(params.classification_id);
        const body = await request.json().catch(() => ({}));
        const parsed = CompleteRequestSchema.safeParse(body);
        if (!parsed.success) {
          return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid body');
        }
        const row = findRow(id);
        if (!row) {
          return problem(
            404,
            'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND',
            'Classification not found',
            `Classification not found: ${id}`,
            { classification_id: id },
          );
        }
        if (
          row.classification.state !== 'accepted' &&
          row.classification.state !== 'overridden'
        ) {
          return problem(
            409,
            'INVALID_STATE_TRANSITION',
            'Invalid state transition',
            `Cannot complete classification in state '${row.classification.state}'. Must be accepted or overridden first.`,
            { classification_id: id, current_state: row.classification.state },
          );
        }
        const prev = row.classification.state;
        patchClassification(id, { state: 'completed' });
        appendAudit({
          classification_id: id,
          previous_state: prev,
          new_state: 'completed',
          transitioned_at: new Date().toISOString(),
          transitioned_by_sub: ANALYST_SUB,
          notes: parsed.data.notes,
        });
        return HttpResponse.json(transitionResponse(id, prev, 'completed'));
      },
    ),

    // ============================================================ STEP COMPLETE (PHASE 1.5)
    http.post(
      u('/v1/classifications/:classification_id/steps/:step_number/complete'),
      async ({ params, request }) => {
        const id = String(params.classification_id);
        const stepNumber = Number(params.step_number);
        if (!Number.isFinite(stepNumber) || stepNumber <= 0) {
          return problem(
            422,
            'VALIDATION_ERROR',
            'Validation error',
            'Invalid step_number',
          );
        }
        const body = await request.json().catch(() => ({}));
        const parsed = StepCompletionRequestSchema.safeParse(body);
        if (!parsed.success) {
          return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid body');
        }
        const outcome = completeStep(id, stepNumber, ANALYST_USERNAME);
        if (!outcome) {
          // Either classification or step not found — return 404 with hint
          if (findRow(id) === null) {
            return problem(
              404,
              'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND',
              'Classification not found',
              `Classification not found: ${id}`,
              { classification_id: id },
            );
          }
          return problem(
            422,
            'DENIAL_TOOL_STEP_NOT_FOUND',
            'Step not found',
            `Step ${stepNumber} not found on classification ${id}.`,
            { classification_id: id, step_number: stepNumber },
          );
        }
        const response: StepCompletionResponse = {
          classification_id: id,
          step_number: stepNumber,
          completed_at: outcome.step.completed_at!,
          completed_by: outcome.step.completed_by!,
          next_step_number: outcome.next_step_number,
          all_steps_completed: outcome.all_steps_completed,
          auto_completed_classification: outcome.auto_completed_classification,
        };
        return HttpResponse.json(response, { status: 201 });
      },
    ),

    // ============================================================ BULK-ACCEPT
    http.post(u('/v1/classifications/bulk-accept'), async ({ request }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = BulkAcceptRequestSchema.safeParse(body);
      if (!parsed.success) {
        return problem(
          422,
          'VALIDATION_ERROR',
          'Validation error',
          'Invalid body',
          { errors: parsed.error.format() },
        );
      }
      const ids = parsed.data.classification_ids;
      const accepted: string[] = [];
      const rejected: BulkAcceptResponse['rejected'] = [];
      const now = new Date().toISOString();

      for (const id of ids) {
        const row = findRow(id);
        if (!row) {
          rejected.push({
            classification_id: id,
            reason: 'NOT_FOUND',
            detail: `Classification ${id} does not exist.`,
          });
          continue;
        }
        if (row.classification.state !== 'recommended') {
          rejected.push({
            classification_id: id,
            reason: 'INVALID_STATE',
            detail: `Classification is in state '${row.classification.state}', not 'recommended'.`,
          });
          continue;
        }
        if (row.classification.confidence !== 'high') {
          rejected.push({
            classification_id: id,
            reason: 'LOW_CONFIDENCE',
            detail: `D-19 gate: confidence is '${row.classification.confidence}', not 'high'.`,
          });
          continue;
        }
        if (row.classification.requires_human_review) {
          rejected.push({
            classification_id: id,
            reason: 'REQUIRES_HUMAN_REVIEW',
            detail: 'D-19 gate: classification flagged for human review.',
          });
          continue;
        }
        patchClassification(id, { state: 'accepted' });
        appendAudit({
          classification_id: id,
          previous_state: 'recommended',
          new_state: 'accepted',
          transitioned_at: now,
          transitioned_by_sub: ANALYST_SUB,
          notes: parsed.data.notes,
        });
        accepted.push(id);
      }
      const response: BulkAcceptResponse = {
        requested: ids.length,
        accepted,
        rejected,
      };
      return HttpResponse.json(response);
    }),

    // ============================================================ AD-HOC CLASSIFY
    http.post(u('/v1/claims/:claim_id/classify'), ({ params }) => {
      const claimIdNum = Number(params.claim_id);
      if (!Number.isFinite(claimIdNum) || claimIdNum <= 0) {
        return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid claim_id');
      }
      const existing = listRows().find((r) => r.claim.claim_id === claimIdNum);
      if (!existing) {
        return problem(
          422,
          'DENIAL_TOOL_CLAIM_HAS_NO_DENIAL_EVENTS',
          'Cannot re-classify',
          `Claim ${claimIdNum} has no denial events to classify.`,
          { claim_id: claimIdNum },
        );
      }
      const fresh: Classification = {
        ...existing.classification,
        classification_id: crypto.randomUUID(),
        classified_at: new Date().toISOString(),
      };
      return HttpResponse.json(fresh);
    }),

    // ============================================================ REVEAL PHI (PHASE 1.5)
    http.post(
      u('/v1/classifications/:classification_id/reveal-phi'),
      async ({ params, request }) => {
        const id = String(params.classification_id);
        const body = await request.json().catch(() => ({}));
        const parsed = RevealPhiRequestSchema.safeParse(body);
        if (!parsed.success) {
          return problem(
            422,
            'VALIDATION_ERROR',
            'Validation error',
            'Invalid body',
          );
        }
        if (findRow(id) === null) {
          return problem(
            404,
            'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND',
            'Classification not found',
            `Classification not found: ${id}`,
            { classification_id: id },
          );
        }
        const auditEventId = crypto.randomUUID();
        const recordedAt = new Date().toISOString();
        appendRevealAudit({
          audit_event_id: auditEventId,
          classification_id: id,
          field_path: parsed.data.field_path,
          purpose: parsed.data.purpose,
          notes: parsed.data.notes,
          recorded_at: recordedAt,
          user_sub: ANALYST_SUB,
        });
        return HttpResponse.json({
          audit_event_id: auditEventId,
          recorded_at: recordedAt,
        });
      },
    ),

    // ============================================================ COST DAILY
    http.get(u('/v1/cost/daily'), ({ request }) => {
      const url = new URL(request.url);
      const start = url.searchParams.get('start_date') ?? undefined;
      const end = url.searchParams.get('end_date') ?? undefined;
      const parsed = CostQuerySchema.safeParse({
        start_date: start,
        end_date: end,
      });
      if (!parsed.success) {
        return problem(
          422,
          'DENIAL_TOOL_COST_QUERY_INVALID',
          'Invalid cost query',
          'start_date / end_date must be ISO dates (YYYY-MM-DD).',
        );
      }
      if (start && end) {
        const diff =
          (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
        if (diff > 90) {
          return problem(
            422,
            'DENIAL_TOOL_COST_QUERY_INVALID',
            'Invalid cost query',
            'Date window must be 90 days or less.',
          );
        }
      }
      return HttpResponse.json(buildCostSummary(start, end));
    }),
  ];
}
