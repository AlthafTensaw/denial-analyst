/**
 * WorkflowStepsList tests.
 *
 * Covers the per-step-completion behavior added in Phase 1.5:
 *   - Sequential completion enforcement (only the next-incomplete step is checkable)
 *   - Already-completed steps render with name + timestamp
 *   - Auto-complete callback fires when response carries that flag
 *   - Permission gating (no denial.act → read-only)
 *   - State gating (recommended / completed → read-only with hint)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkflowStepsList } from '../WorkflowStepsList';
import type { WorkflowStep } from '../../actions/schemas';

// ---- mocks ----------------------------------------------------------------

const mutateAsync = vi.fn();
const useAuthStoreMock = vi.fn();

vi.mock('@tensaw/actions', () => ({
  useActionMutation: () => [
    mutateAsync,
    { isLoading: false, error: null },
  ],
}));

vi.mock('@tensaw/runtime', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector(useAuthStoreMock()),
}));

// Stub the problem-details helper so we don't need the full module shape
vi.mock('../../lib/problem', () => ({
  friendlyErrorMessage: (e: unknown) =>
    e instanceof Error ? e.message : 'unknown error',
}));

// ---- fixtures -------------------------------------------------------------

const STEPS: WorkflowStep[] = [
  {
    step: 1,
    action: 'Identify the correct payer.',
    owner: 'AR',
    sla_days: 3,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 2,
    action: 'Verify the correct payer through eligibility.',
    owner: 'AR',
    sla_days: 1,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 3,
    action: 'Refile to correct payer.',
    owner: 'AR / Resolution',
    sla_days: 1,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
];

const STEPS_WITH_FIRST_DONE: WorkflowStep[] = [
  { ...STEPS[0]!, completed_at: '2026-05-15T12:00:00Z', completed_by: 'renita.scott' },
  STEPS[1]!,
  STEPS[2]!,
];

const STEPS_ALL_DONE: WorkflowStep[] = STEPS.map((s, i) => ({
  ...s,
  completed_at: `2026-05-1${5 + i}T12:00:00Z`,
  completed_by: 'renita.scott',
}));

const CLASSIFICATION_ID = 'ffffffff-1111-4222-8333-444444444444';

const userWithAct = { permissions: ['denial.read', 'denial.act'] };
const userReadOnly = { permissions: ['denial.read'] };

beforeEach(() => {
  mutateAsync.mockReset();
  useAuthStoreMock.mockReturnValue({ user: userWithAct });
});

// ---- tests ----------------------------------------------------------------

describe('WorkflowStepsList — sequential completion', () => {
  it('only the first incomplete step is checkable; later steps are disabled', () => {
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS}
        onStepCompleted={() => {}}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect((checkboxes[0] as HTMLInputElement).disabled).toBe(false);
    expect((checkboxes[1] as HTMLInputElement).disabled).toBe(true);
    expect((checkboxes[2] as HTMLInputElement).disabled).toBe(true);
  });

  it('after step 1 is done in the fixture, step 2 becomes checkable', () => {
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS_WITH_FIRST_DONE}
        onStepCompleted={() => {}}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[0] as HTMLInputElement).disabled).toBe(true); // completed steps stay locked
    expect((checkboxes[1] as HTMLInputElement).disabled).toBe(false);
    expect((checkboxes[2] as HTMLInputElement).disabled).toBe(true);
  });

  it('clicking the next-incomplete step dispatches step-complete with the right payload', async () => {
    mutateAsync.mockResolvedValue({
      ok: true,
      data: {
        next_step_number: 2,
        all_steps_completed: false,
        auto_completed_classification: false,
      },
    });
    const onCompleted = vi.fn();
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS}
        onStepCompleted={onCompleted}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await waitFor(() => { expect(mutateAsync).toHaveBeenCalledTimes(1); });
    expect(mutateAsync).toHaveBeenCalledWith({
      classification_id: CLASSIFICATION_ID,
      step_number: 1,
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });
});

describe('WorkflowStepsList — auto-complete signal', () => {
  it('fires onAutoComplete when response carries auto_completed_classification: true', async () => {
    mutateAsync.mockResolvedValue({
      ok: true,
      data: {
        next_step_number: null,
        all_steps_completed: true,
        auto_completed_classification: true,
      },
    });
    const onAutoComplete = vi.fn();
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS}
        onStepCompleted={() => {}}
        onAutoComplete={onAutoComplete}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await waitFor(() => { expect(onAutoComplete).toHaveBeenCalledTimes(1); });
  });

  it('does NOT fire onAutoComplete when flag is false', async () => {
    mutateAsync.mockResolvedValue({
      ok: true,
      data: {
        next_step_number: 2,
        all_steps_completed: false,
        auto_completed_classification: false,
      },
    });
    const onAutoComplete = vi.fn();
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS}
        onStepCompleted={() => {}}
        onAutoComplete={onAutoComplete}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await waitFor(() => { expect(mutateAsync).toHaveBeenCalled(); });
    expect(onAutoComplete).not.toHaveBeenCalled();
  });
});

describe('WorkflowStepsList — permission + state gating', () => {
  it('read-only user cannot interact with any checkboxes', () => {
    useAuthStoreMock.mockReturnValue({ user: userReadOnly });
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS}
        onStepCompleted={() => {}}
      />,
    );
    screen
      .getAllByRole('checkbox')
      .forEach((cb) => { expect((cb as HTMLInputElement).disabled).toBe(true); });
  });

  it("state=recommended shows hint and disables all checkboxes", () => {
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="recommended"
        steps={STEPS}
        onStepCompleted={() => {}}
      />,
    );
    expect(
      screen.getByText(/Accept or override.+before marking steps complete/i),
    ).toBeTruthy();
    screen
      .getAllByRole('checkbox')
      .forEach((cb) => { expect((cb as HTMLInputElement).disabled).toBe(true); });
  });

  it('state=completed shows hint about no further action', () => {
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="completed"
        steps={STEPS_ALL_DONE}
        onStepCompleted={() => {}}
      />,
    );
    expect(
      screen.getByText(/already completed/i),
    ).toBeTruthy();
  });
});

describe('WorkflowStepsList — completion display', () => {
  it('renders the completed_by name when step is done', () => {
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS_WITH_FIRST_DONE}
        onStepCompleted={() => {}}
      />,
    );
    expect(screen.getByText(/renita.scott/i)).toBeTruthy();
  });

  it('renders empty-state message when steps array is empty', () => {
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={[]}
        onStepCompleted={() => {}}
      />,
    );
    expect(
      screen.getByText(/No workflow steps defined/i),
    ).toBeTruthy();
  });
});

describe('WorkflowStepsList — error handling', () => {
  it('surfaces a dismissible error banner when the mutation rejects', async () => {
    mutateAsync.mockRejectedValue(new Error('Network down'));
    render(
      <WorkflowStepsList
        classificationId={CLASSIFICATION_ID}
        state="accepted"
        steps={STEPS}
        onStepCompleted={() => {}}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await waitFor(() =>
      { expect(screen.getByRole('alert').textContent).toMatch(/Step 1 failed/i); },
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Network down/i);
  });
});
