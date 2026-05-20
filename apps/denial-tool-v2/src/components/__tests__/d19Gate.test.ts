/**
 * d19Gate — unit tests.
 *
 * Coverage:
 *   - All-recommended + all-high-conf + no human-review → ok
 *   - Mixed state → rejected (INVALID_STATE-style on FE)
 *   - Mixed confidence → rejected (LOW_CONFIDENCE-style)
 *   - Human-review flag → rejected
 *   - Cross-category selection → ALLOWED (PR-3's category_mismatch
 *     constraint was removed; backend doesn't enforce it).
 *   - Empty selection → rejected
 */

import { describe, expect, it } from 'vitest';
import type { WorklistRow } from '../../actions/schemas';
import { evaluateD19Gate } from '../d19Gate';

const baseClassification = {
  classification_id: '11111111-1111-4111-8111-111111111111',
  claim_id: 314001,
  classified_at: '2026-05-17T12:00:00Z',
  tool_version: 'phase1-0.1.0',
  training_guide_version: 'v3.0',
  primary_category: '02. Wrong Payer / Misrouted',
  training_guide_section: '6.6',
  alternate_categories: [],
  classification_source: 'rule' as const,
  rule_id: 'RULE_CO109_WRONGPAYER',
  confidence: 'high' as const,
  workflow_steps: [],
  branch_chosen: 'standard',
  recommended_owner: 'AR → Bhavana',
  sla_next_action_date: '2026-05-20',
  priority_chips: [],
  risk_flags: [],
  requires_human_review: false,
  reasoning_summary: 'baseline',
  state: 'recommended' as const,
};

const baseClaim = {
  claim_id: 314001,
  clinic: 'LSAT',
  primary_payer_name: 'Medicare TX',
  dos: '2026-04-01',
  amount: '500.00',
  net_pending: '500.00',
  aging_bucket: '30-59 day',
  cpt_lines: ['99213'],
  appeal_status: null,
  current_status_code: 5,
  current_status_label: 'Denied',
};

function row(
  seed: number,
  overrides: Partial<typeof baseClassification> = {},
  claimOverrides: Partial<typeof baseClaim> = {},
): WorklistRow {
  const uuidSeed = seed.toString(16).padStart(8, '0');
  return {
    claim: {
      ...baseClaim,
      claim_id: 314000 + seed,
      ...claimOverrides,
    },
    classification: {
      ...baseClassification,
      classification_id: `${uuidSeed}-1111-4111-8111-111111111111`,
      claim_id: 314000 + seed,
      ...overrides,
    },
  };
}

describe('evaluateD19Gate', () => {
  it('passes when all rows are recommended + high + not flagged', () => {
    const result = evaluateD19Gate([row(1), row(2), row(3)]);
    expect(result.ok).toBe(true);
  });

  it('rejects when any row is not in state recommended', () => {
    const result = evaluateD19Gate([row(1), row(2, { state: 'accepted' })]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/state 'accepted'/);
      expect(result.classificationId).toBeTruthy();
    }
  });

  it('rejects when any row has medium confidence', () => {
    const result = evaluateD19Gate([
      row(1),
      row(2, { confidence: 'medium' }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/confidence=medium/);
    }
  });

  it('rejects when any row has low confidence', () => {
    const result = evaluateD19Gate([row(1, { confidence: 'low' })]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/confidence=low/);
    }
  });

  it('rejects when any row requires human review', () => {
    const result = evaluateD19Gate([
      row(1),
      row(2, { requires_human_review: true }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/human review/);
    }
  });

  it('ALLOWS cross-category selection (backend does not enforce single-category gate)', () => {
    const result = evaluateD19Gate([
      row(1, { primary_category: '02. Wrong Payer / Misrouted' }),
      row(2, { primary_category: '10. Duplicate Claim' }),
    ]);
    expect(result.ok).toBe(true);
  });

  it('rejects empty selection', () => {
    const result = evaluateD19Gate([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/No rows/);
    }
  });
});
