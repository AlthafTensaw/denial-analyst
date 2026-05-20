/**
 * D-19 acceptance gate — client-side evaluator.
 *
 * Per Day-12 backend reality, the strict gate enforces:
 *   - state == 'recommended' (server's INVALID_STATE rejection)
 *   - confidence == 'high' (server's LOW_CONFIDENCE rejection)
 *   - !requires_human_review (server's REQUIRES_HUMAN_REVIEW rejection)
 *
 * PR-3's `category_mismatch` constraint was an FE over-enforcement.
 * Backend does NOT require single-shared-category in bulk-accept —
 * cross-category bulk accepts are allowed. We drop that check.
 *
 * The gate runs client-side as a UX backstop (disable the button + tooltip
 * the breaking row). Server re-validates on every bulk-accept call.
 */

import type { WorklistRow } from '../actions/schemas';

export type GateResult =
  | { ok: true }
  | { ok: false; reason: string; classificationId?: string };

export function evaluateD19Gate(
  selected: readonly WorklistRow[],
): GateResult {
  if (selected.length === 0) {
    return { ok: false, reason: 'No rows selected' };
  }

  // Every row must be state=recommended (only state we can accept from)
  const wrongState = selected.find(
    (r) => r.classification.state !== 'recommended',
  );
  if (wrongState) {
    return {
      ok: false,
      reason: `Row ${wrongState.classification.classification_id.slice(0, 8)} (claim ${wrongState.claim.claim_id}) is in state '${wrongState.classification.state}'; deselect to enable.`,
      classificationId: wrongState.classification.classification_id,
    };
  }

  // Every row must be confidence=high
  const notHigh = selected.find(
    (r) => r.classification.confidence !== 'high',
  );
  if (notHigh) {
    return {
      ok: false,
      reason: `Row claim ${notHigh.claim.claim_id} has confidence=${notHigh.classification.confidence}; deselect to enable.`,
      classificationId: notHigh.classification.classification_id,
    };
  }

  // No row may flag requires_human_review
  const flagged = selected.find(
    (r) => r.classification.requires_human_review,
  );
  if (flagged) {
    return {
      ok: false,
      reason: `Row claim ${flagged.claim.claim_id} requires human review.`,
      classificationId: flagged.classification.classification_id,
    };
  }

  return { ok: true };
}
