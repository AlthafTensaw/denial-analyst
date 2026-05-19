/**
 * Denial Tool — in-memory state for MSW handlers (PR-5).
 *
 * PR-5 additions:
 *   - completeStep(): marks a workflow step done by patching its
 *     `completed_at` + `completed_by` fields. Idempotent — re-marking
 *     a completed step returns the original timestamp.
 *   - Auto-transition: when completeStep finishes the last step AND
 *     the classification is in `accepted` or `overridden`, the
 *     classification state auto-advances to `completed`.
 */

import type {
  Classification,
  WorkflowStep,
  WorklistRow,
} from '../schemas/denial';
import { WORKLIST_ROWS } from '../fixtures/denial/recommendations';

let rows: WorklistRow[] = WORKLIST_ROWS.map(cloneRow);

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

interface RevealPhiAuditEntry {
  audit_event_id: string;
  classification_id: string;
  field_path: string;
  purpose: string;
  notes?: string;
  recorded_at: string;
  user_sub: string;
}

let stateAudit: OverrideAuditEntry[] = [];
let revealAudit: RevealPhiAuditEntry[] = [];

function cloneRow(r: WorklistRow): WorklistRow {
  return {
    claim: { ...r.claim },
    classification: {
      ...r.classification,
      workflow_steps: r.classification.workflow_steps.map((s) => ({ ...s })),
    },
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listRows(): WorklistRow[] {
  return rows;
}

export function findRow(classificationId: string): WorklistRow | null {
  return (
    rows.find((r) => r.classification.classification_id === classificationId) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Mutations — classification state
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutations — step completion (Phase 1.5)
// ---------------------------------------------------------------------------

export interface StepCompletionOutcome {
  row: WorklistRow;
  step: WorkflowStep;
  next_step_number: number | null;
  all_steps_completed: boolean;
  auto_completed_classification: boolean;
}

/**
 * Mark step `stepNumber` complete on `classificationId`. Returns the
 * outcome including next-step pointer and any auto-transition that
 * fired. Returns null if classification or step not found.
 *
 * Idempotency: re-marking an already-completed step returns the original
 * timestamp + completed_by and does NOT update them, matching backend.
 */
export function completeStep(
  classificationId: string,
  stepNumber: number,
  completedBy: string,
): StepCompletionOutcome | null {
  const idx = rows.findIndex(
    (r) => r.classification.classification_id === classificationId,
  );
  if (idx < 0) return null;
  const row = rows[idx]!;
  const steps = row.classification.workflow_steps;
  const stepIdx = steps.findIndex((s) => s.step === stepNumber);
  if (stepIdx < 0) return null;
  const step = steps[stepIdx]!;

  let updatedStep: WorkflowStep;
  if (step.completed_at != null) {
    // Idempotent — return as-is
    updatedStep = step;
  } else {
    updatedStep = {
      ...step,
      completed_at: new Date().toISOString(),
      completed_by: completedBy,
    };
  }

  const newSteps = steps.map((s, i) => (i === stepIdx ? updatedStep : s));
  const allDone = newSteps.every((s) => s.completed_at != null);
  const nextIncomplete = newSteps.find((s) => s.completed_at == null);
  const nextStepNumber = nextIncomplete?.step ?? null;

  let newState = row.classification.state;
  let autoCompleted = false;
  if (
    allDone &&
    (row.classification.state === 'accepted' ||
      row.classification.state === 'overridden')
  ) {
    newState = 'completed';
    autoCompleted = true;
  }

  const updatedRow: WorklistRow = {
    ...row,
    classification: {
      ...row.classification,
      workflow_steps: newSteps,
      state: newState,
    },
  };
  rows[idx] = updatedRow;

  return {
    row: updatedRow,
    step: updatedStep,
    next_step_number: nextStepNumber,
    all_steps_completed: allDone,
    auto_completed_classification: autoCompleted,
  };
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export function appendAudit(entry: OverrideAuditEntry): void {
  stateAudit = [...stateAudit, entry];
}

export function listAudit(): readonly OverrideAuditEntry[] {
  return stateAudit;
}

export function appendRevealAudit(entry: RevealPhiAuditEntry): void {
  revealAudit = [...revealAudit, entry];
}

export function listRevealAudit(): readonly RevealPhiAuditEntry[] {
  return revealAudit;
}

// ---------------------------------------------------------------------------
// Reset for tests
// ---------------------------------------------------------------------------

export function resetMockDenialState(): void {
  rows = WORKLIST_ROWS.map(cloneRow);
  stateAudit = [];
  revealAudit = [];
}
