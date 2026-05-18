/**
 * Denial Tool — MSW handlers (PR-4 rewrite).
 *
 * Implements the exact 8 backend endpoints from denial-tool-service Phase 1
 * Day 12 OpenAPI spec. Critical differences from PR-2's handlers:
 *
 *   1. NO RESPONSE ENVELOPE. Backend returns bare Pydantic models. The
 *      handlers used to wrap with buildSuccessEnvelope; that's gone.
 *
 *   2. PROBLEM-DETAILS ON ERROR. Backend returns RFC 7807 application/
 *      problem+json with { type, title, status, detail, error_code,
 *      correlation_id, claim_id? }. Mirror that here so dev + prod
 *      look identical.
 *
 *   3. UUID identifiers. Routes use classification_id paths, not int ids.
 *
 *   4. Fixed sort. Backend orders rows by state (recommended first) then
 *      classified_at desc. We replicate it so the FE's worklist looks
 *      consistent. No sort_by / sort_dir query params.
 *
 *   5. Single-valued filters. No arrays — the FE only sends one value
 *      per filter dimension.
 *
 *   6. D-19 bulk-accept rejection reasons: NOT_FOUND / INVALID_STATE /
 *      LOW_CONFIDENCE / REQUIRES_HUMAN_REVIEW. NOT `category_mismatch`.
 *      (PR-2's mock over-enforced; backend doesn't require single
 *      shared category in bulk-accept.)
 *
 * Endpoints implemented:
 *
 *   GET    /v1/claims/worklist
 *   GET    /v1/classifications/{classification_id}
 *   GET    /v1/cost/daily
 *   POST   /v1/classifications/{classification_id}/accept
 *   POST   /v1/classifications/{classification_id}/override
 *   POST   /v1/classifications/{classification_id}/complete
 *   POST   /v1/classifications/bulk-accept
 *   POST   /v1/claims/{claim_id}/classify
 *
 * /healthz and /readyz are NOT mocked — not UI surfaces.
 */

import { http, HttpResponse } from 'msw';

import {
  AcceptRequestSchema,
  BulkAcceptRequestSchema,
  CompleteRequestSchema,
  CostQuerySchema,
  OverrideRequestSchema,
  WorklistRequestSchema,
  type BulkAcceptResponse,
  type Classification,
  type StateTransitionResponse,
  type WorklistRow,
} from '../schemas/denial';
import {
  appendAudit,
  findRow,
  listRows,
  patchClassification,
} from './denialState';
import { buildCostSummary } from '../fixtures/denial/costDaily';

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
) {
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

/**
 * Apply backend's fixed sort: state=recommended floats to the top, then
 * classified_at desc within each state bucket.
 */
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
  if (req.state !== undefined) {
    out = out.filter((r) => r.classification.state === req.state);
  }
  if (req.primary_category !== undefined) {
    out = out.filter(
      (r) => r.classification.primary_category === req.primary_category,
    );
  }
  if (req.recommended_owner !== undefined) {
    out = out.filter(
      (r) => r.classification.recommended_owner === req.recommended_owner,
    );
  }
  if (req.payer_name !== undefined) {
    out = out.filter((r) => r.claim.primary_payer_name === req.payer_name);
  }
  if (req.min_amount_cents !== undefined) {
    out = out.filter(
      (r) => Math.round(Number(r.claim.net_pending) * 100) >= req.min_amount_cents!,
    );
  }
  if (req.age_bucket !== undefined) {
    out = out.filter((r) => r.claim.aging_bucket === req.age_bucket);
  }
  if (req.requires_human_review !== undefined) {
    out = out.filter(
      (r) =>
        r.classification.requires_human_review === req.requires_human_review,
    );
  }
  if (req.priority_chip !== undefined) {
    out = out.filter((r) =>
      r.classification.priority_chips.includes(req.priority_chip!),
    );
  }
  if (req.classification_source !== undefined) {
    out = out.filter(
      (r) => r.classification.classification_source === req.classification_source,
    );
  }
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
    // -------------------------------------------------------------- list
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
      const hasMore = start + paged.length < total;

      return HttpResponse.json({
        rows: paged,
        total,
        page: req.page,
        page_size: req.page_size,
        has_more: hasMore,
      });
    }),

    // -------------------------------------------------------------- detail
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
      // Backend's GET /classifications/{id} returns just the Classification,
      // not a row wrapper. Match that.
      return HttpResponse.json(row.classification);
    }),

    // -------------------------------------------------------------- accept
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
            {
              classification_id: id,
              current_state: row.classification.state,
            },
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

    // -------------------------------------------------------------- override
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
            {
              classification_id: id,
              current_state: row.classification.state,
            },
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

    // -------------------------------------------------------------- complete
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
        // Backend allows complete from accepted | overridden but not from
        // recommended or completed.
        if (
          row.classification.state !== 'accepted' &&
          row.classification.state !== 'overridden'
        ) {
          return problem(
            409,
            'INVALID_STATE_TRANSITION',
            'Invalid state transition',
            `Cannot complete classification in state '${row.classification.state}'. Must be accepted or overridden first.`,
            {
              classification_id: id,
              current_state: row.classification.state,
            },
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

    // -------------------------------------------------------------- bulk-accept
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
        // Accept
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

    // -------------------------------------------------------------- ad-hoc classify
    http.post(u('/v1/claims/:claim_id/classify'), ({ params }) => {
      const claimIdNum = Number(params.claim_id);
      if (!Number.isFinite(claimIdNum) || claimIdNum <= 0) {
        return problem(422, 'VALIDATION_ERROR', 'Validation error', 'Invalid claim_id');
      }
      // Find existing classification for the claim, or return 422 if none.
      // The real backend re-runs the classifier; the mock just returns
      // the latest known classification for the claim or 422.
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
      // Real backend returns a fresh Classification; we return the existing
      // one with a bumped classified_at.
      const fresh: Classification = {
        ...existing.classification,
        classification_id: crypto.randomUUID(),
        classified_at: new Date().toISOString(),
      };
      return HttpResponse.json(fresh);
    }),

    // -------------------------------------------------------------- cost daily
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
      // Enforce 90-day max window (matches backend)
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
