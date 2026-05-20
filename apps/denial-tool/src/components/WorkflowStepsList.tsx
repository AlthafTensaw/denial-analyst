/**
 * WorkflowStepsList — per-step checkboxes with sequential UX.
 *
 * PR-6: tailwind utility classes throughout, platform Checkbox +
 * Tooltip, useActionMutation routed through the platform's
 * [fire, state] tuple convention (the dev's bug report #1 fix).
 *
 * Sequential completion: only the next-incomplete step is clickable.
 * The backend allows out-of-order, but the UX intentionally enforces
 * sequence so analysts work through the plan deliberately.
 *
 * State-aware hints:
 *   - state=recommended + all steps done → "Accept or Override before completion"
 *   - state=completed                   → "Already completed"
 *   - canAct=false                       → checkboxes disabled (no mutation)
 *
 * Auto-transition: when StepCompletionResponse.auto_completed_classification
 * is true, `onAutoComplete()` fires for the parent to refetch.
 */

import { Checkbox } from '@tensaw/design-system/primitives';
import { Tooltip } from '@tensaw/design-system/overlays';
import { Alert } from '@tensaw/design-system/feedback';
import { useActionMutation } from '@tensaw/actions';
import type {
  Classification,
  StepCompletionResponse,
  WorkflowStep,
} from '../actions/schemas';

interface WorkflowStepsListProps {
  classification: Classification;
  canAct: boolean;
  onStepCompleted: (resp: StepCompletionResponse) => void;
  onAutoComplete: () => void;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WorkflowStepsList({
  classification,
  canAct,
  onStepCompleted,
  onAutoComplete,
}: WorkflowStepsListProps) {
  const steps = classification.workflow_steps;
  const firstIncomplete = steps.find((s) => !s.completed_at);
  const allComplete = steps.length > 0 && !firstIncomplete;

  const [fireStep, { isLoading: stepLoading }] =
    useActionMutation<
      { classificationId: string; stepNumber: number; body: { notes?: string } },
      StepCompletionResponse
    >('denial.step-complete');

  const handleCheck = (step: WorkflowStep) => {
    if (!canAct || step.completed_at) return;
    fireStep({
      classificationId: classification.classification_id,
      stepNumber: step.step,
      body: {},
    })
      .then((resp) => {
        onStepCompleted(resp);
        if (resp.auto_completed_classification) onAutoComplete();
      })
      .catch(() => {
        /* dispatcher pushed the error toast */
      });
  };

  // Empty workflow
  if (steps.length === 0) {
    return (
      <Alert variant="info" tone="subtle">
        No workflow steps published for this category yet.
      </Alert>
    );
  }

  const state = classification.state;
  const hintForState =
    state === 'completed'
      ? 'Already completed.'
      : allComplete && state === 'recommended'
        ? 'All steps marked done. Accept or override the classification to record completion.'
        : !canAct
          ? 'Read-only — your role does not allow workflow actions.'
          : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs uppercase tracking-wide text-secondary font-medium">
          Recommended action plan ·{' '}
          {steps.filter((s) => s.completed_at).length} of {steps.length} done
        </span>
        <span className="text-xs text-secondary">
          Owner: {classification.recommended_owner} · SLA{' '}
          <span className="text-warning">
            {steps[0]?.sla_days ?? 0}d
          </span>
        </span>
      </div>

      {steps.map((step) => {
        const isDone = !!step.completed_at;
        const isNext = !isDone && step === firstIncomplete;
        const isClickable = canAct && isNext && !stepLoading;

        const row = (
          <div
            key={step.step}
            className={[
              'flex items-start gap-2.5 px-3 py-2 rounded-md',
              isDone
                ? 'bg-secondary opacity-70'
                : isNext
                  ? 'bg-teal-50 border-l-4 border-teal-700'
                  : 'bg-primary border border-tertiary opacity-60',
            ].join(' ')}
          >
            <Checkbox
              checked={isDone}
              disabled={!isClickable}
              onChange={() => handleCheck(step)}
              ariaLabel={`Mark step ${step.step} complete: ${step.action}`}
            />
            <div className="flex-1 text-sm">
              <div
                className={
                  isDone ? 'line-through text-secondary' : 'font-medium'
                }
              >
                {step.action}
              </div>
              <div className="text-xs text-secondary mt-0.5">
                {isDone ? (
                  <>
                    ✓ {step.completed_by ?? 'someone'} ·{' '}
                    {step.completed_at
                      ? formatRelative(step.completed_at)
                      : ''}
                  </>
                ) : (
                  <>
                    {isNext ? '→ Next action · ' : ''}
                    {step.owner} · {step.sla_days} day SLA
                  </>
                )}
              </div>
            </div>
          </div>
        );

        return isClickable ? (
          row
        ) : (
          <Tooltip
            key={step.step}
            content={
              isDone
                ? 'Completed'
                : !canAct
                  ? 'Read-only'
                  : 'Complete earlier steps first'
            }
          >
            {row}
          </Tooltip>
        );
      })}

      {hintForState ? (
        <Alert variant="info" tone="subtle" className="mt-1">
          {hintForState}
        </Alert>
      ) : null}
    </div>
  );
}
