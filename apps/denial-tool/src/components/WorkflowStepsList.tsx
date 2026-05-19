/**
 * WorkflowStepsList — per-step completion checkboxes (Phase 1.5).
 *
 * Replaces PR-4's read-only <ol> rendering of workflow steps. Each step
 * has a checkbox; clicking it dispatches `denial.step-complete`. The
 * response shape carries:
 *   - `next_step_number` → drives the "current" step highlight
 *   - `all_steps_completed` → all checkboxes filled
 *   - `auto_completed_classification` → classification state auto-flipped
 *     to `completed` (backend chains the transition when applicable);
 *     the parent's `onAutoComplete` fires so it can show a toast + refetch.
 *
 * The component is read-only when:
 *   - User lacks `denial.act` permission
 *   - Classification is in state `recommended` (analyst must accept/override
 *     first) or `completed` (workflow already closed)
 *
 * Idempotency: the backend treats re-marking a completed step as a no-op
 * and returns the original timestamp. We disable the checkbox once
 * completed so the user can't toggle it off — there's no "uncomplete"
 * mutation in Phase 1.5.
 */

import { useState } from 'react';
import { useActionMutation } from '@tensaw/actions';
import { useAuthStore } from '@tensaw/runtime';
import type {
  ClassificationState,
  WorkflowStep,
} from '../actions/schemas';
import { friendlyErrorMessage } from '../lib/problem';

interface WorkflowStepsListProps {
  classificationId: string;
  state: ClassificationState;
  steps: WorkflowStep[];
  /** Called after step-complete returns. Parent re-fetches so the step list updates. */
  onStepCompleted: () => void;
  /** Called when the backend signals auto_completed_classification: true. */
  onAutoComplete?: () => void;
}

export function WorkflowStepsList({
  classificationId,
  state,
  steps,
  onStepCompleted,
  onAutoComplete,
}: WorkflowStepsListProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const canAct = user?.permissions.includes('denial.act') ?? false;
  const [mutateStepComplete, { isLoading: stepCompletePending }] = useActionMutation('denial.step-complete');
  const [error, setError] = useState<string | null>(null);

  // Only allow checkbox interactions when the classification is in a
  // workable state. `recommended` requires accept/override first; `completed`
  // is closed out.
  const interactive = canAct && (state === 'accepted' || state === 'overridden');

  if (steps.length === 0) {
    return (
      <p style={emptyStyle}>
        No workflow steps defined for this category. Manual triage required.
      </p>
    );
  }

  const nextIncompleteStep = steps.find((s) => !s.completed_at);

  const handleToggle = async (step: WorkflowStep) => {
    if (!interactive || step.completed_at) return;
    setError(null);
    try {
      const result = await mutateStepComplete({
        classification_id: classificationId,
        step_number: step.step,
      });
      if (!result.ok) throw new Error(result.error.message);
      const response = result.data as {
        next_step_number: number | null;
        all_steps_completed: boolean;
        auto_completed_classification: boolean;
      };
      onStepCompleted();
      if (response.auto_completed_classification) {
        onAutoComplete?.();
      }
    } catch (err) {
      setError(`Step ${step.step} failed: ${friendlyErrorMessage(err)}`);
    }
  };

  return (
    <div>
      <ol style={listStyle}>
        {steps.map((step) => {
          const done = step.completed_at !== null;
          const isNext = !done && step === nextIncompleteStep;
          return (
            <li
              key={step.step}
              style={{
                ...stepStyle,
                background: isNext ? 'var(--tw-color-table-header-bg, #EBF7F6)' : undefined,
                borderColor: isNext
                  ? 'var(--tw-color-border-focus, #A7DEDA)'
                  : 'var(--tw-color-border-default)',
              }}
            >
              <input
                type="checkbox"
                checked={done}
                disabled={
                  done ||
                  !interactive ||
                  stepCompletePending ||
                  // Only the next-incomplete is checkable (forces sequential completion in UX)
                  (!isNext && !done)
                }
                onChange={() => void handleToggle(step)}
                aria-label={`Mark step ${step.step} complete: ${step.action.slice(0, 50)}`}
                style={checkboxStyle}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    ...stepActionStyle,
                    textDecoration: done ? 'line-through' : 'none',
                    color: done
                      ? 'var(--tw-color-text-muted)'
                      : 'var(--tw-color-text-primary)',
                  }}
                >
                  Step {step.step}: {step.action}
                </div>
                <div style={stepMetaStyle}>
                  <strong>{step.owner}</strong> · SLA{' '}
                  <strong>{step.sla_days}d</strong> · {step.mode}
                  {step.day && <> · {step.day}</>}
                  {done && step.completed_by && (
                    <>
                      {' · '}
                      <span style={{ color: 'var(--tw-color-brand-header, #149A9A)' }}>
                        ✓ {step.completed_by}
                        {step.completed_at &&
                          ` on ${formatCompletedAt(step.completed_at)}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {!interactive && canAct && state === 'recommended' && (
        <div style={hintStyle}>
          Accept or override this recommendation before marking steps complete.
        </div>
      )}
      {!interactive && canAct && state === 'completed' && (
        <div style={hintStyle}>
          This classification is already completed. No further action needed.
        </div>
      )}
      {error && (
        <div role="alert" style={errorStyle}>
          {error}
          <button
            type="button"
            onClick={() => { setError(null); }}
            style={errorCloseStyle}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function formatCompletedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

const listStyle: React.CSSProperties = {
  margin: '8px 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: 6,
};

const stepStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '8px 10px',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 6,
  background: 'white',
  alignItems: 'flex-start',
};

const checkboxStyle: React.CSSProperties = {
  marginTop: 2,
  cursor: 'pointer',
};

const stepActionStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  lineHeight: 1.5,
};

const stepMetaStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--tw-color-text-muted)',
  marginTop: 4,
};

const emptyStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
  margin: 0,
};

const hintStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: '0.75rem',
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
};

const errorStyle: React.CSSProperties = {
  position: 'relative',
  marginTop: 8,
  padding: '8px 32px 8px 10px',
  background: 'var(--tw-color-status-error-bg, #FEF2F2)',
  color: 'var(--tw-color-status-error-fg, #B91C1C)',
  border: '1px solid var(--tw-color-status-error-fg, #FCA5A5)',
  borderRadius: 6,
  fontSize: '0.8125rem',
};

const errorCloseStyle: React.CSSProperties = {
  position: 'absolute',
  right: 4,
  top: 2,
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  fontSize: '1rem',
  cursor: 'pointer',
};
