/**
 * Denial Tool — in-memory state for MSW handlers.
 *
 * Keyed on classification_id (UUID string). Reset between tests so
 * mutations don't leak across specs.
 */

import type { Classification, WorklistRow } from '../schemas/denial';
import { WORKLIST_ROWS } from '../fixtures/denial/recommendations';

let rows: WorklistRow[] = WORKLIST_ROWS.map((r) => ({
  ...r,
  classification: { ...r.classification },
  claim: { ...r.claim },
}));

interface OverrideAuditEntry {
  classification_id: string;
  previous_state: Classification['state'];
  new_state: Classification['state'];
  transitioned_at: string;
  transitioned_by_sub: string;
  reason?: string;
  notes?: string;
  corrected_category?: string;
  corrected_branch?: string;
}

let auditLog: OverrideAuditEntry[] = [];

export function listRows(): WorklistRow[] {
  return rows;
}

export function findRow(classificationId: string): WorklistRow | null {
  return (
    rows.find((r) => r.classification.classification_id === classificationId) ??
    null
  );
}

export function patchClassification(
  classificationId: string,
  patch: Partial<Classification>,
): WorklistRow | null {
  const idx = rows.findIndex(
    (r) => r.classification.classification_id === classificationId,
  );
  if (idx < 0) return null;
  const existing = rows[idx]!;
  const updated: WorklistRow = {
    ...existing,
    classification: { ...existing.classification, ...patch },
  };
  rows[idx] = updated;
  return updated;
}

export function appendAudit(entry: OverrideAuditEntry): void {
  auditLog = [...auditLog, entry];
}

export function listAudit(): readonly OverrideAuditEntry[] {
  return auditLog;
}

export function resetMockDenialState(): void {
  rows = WORKLIST_ROWS.map((r) => ({
    ...r,
    classification: { ...r.classification },
    claim: { ...r.claim },
  }));
  auditLog = [];
}
