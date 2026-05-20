/**
 * OverrideModal — per-row override flow.
 *
 * PR-4 changes from PR-3:
 *   - 5 override reasons (added `worked_outside_tool` per D-08).
 *   - Field names match backend's OverrideRequest:
 *     `reason` / `corrected_category` / `corrected_branch` / `notes`
 *     (was: override_reason / analyst_chosen_category / comment).
 *   - Adds `corrected_branch` field — analyst can specify a different
 *     workflow branch (e.g., "true_duplicate" vs "ambiguous") when
 *     keeping the category but changing the path.
 *   - Reason descriptions are sourced VERBATIM from the backend's
 *     OverrideReason docstring (per handoff doc directive). Surface
 *     this language exactly; do not paraphrase.
 */

import { useEffect, useId, useState } from 'react';
import {
  CATEGORY_VALUES,
  OVERRIDE_REASON_COPY,
  OverrideReasonEnum,
  type OverrideReason,
} from '../actions/schemas';

export interface OverrideSubmission {
  reason: OverrideReason;
  corrected_category?: string;
  corrected_branch?: string;
  notes?: string;
}

interface OverrideModalProps {
  /** Pre-selected reason when opened (used by "Mark as worked outside tool" flow). */
  initialReason?: OverrideReason;
  /** Existing classification category — pre-fills corrected_category when reason=tool_wrong. */
  currentCategory?: string;
  /** Existing branch (display only). */
  currentBranch?: string | null;
  onCancel: () => void;
  onSubmit: (payload: OverrideSubmission) => void | Promise<void>;
  submitting?: boolean;
}

export function OverrideModal({
  initialReason,
  currentCategory,
  currentBranch,
  onCancel,
  onSubmit,
  submitting,
}: OverrideModalProps): JSX.Element {
  const titleId = useId();
  const [reason, setReason] = useState<OverrideReason | ''>(
    initialReason ?? '',
  );
  const [correctedCategory, setCorrectedCategory] = useState<string>('');
  const [correctedBranch, setCorrectedBranch] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (initialReason) setReason(initialReason);
  }, [initialReason]);

  const reasonValid = OverrideReasonEnum.safeParse(reason).success;
  const requiresCategory =
    reasonValid && OVERRIDE_REASON_COPY[reason as OverrideReason].requiresCategory;
  const categoryValid = requiresCategory
    ? correctedCategory.length > 0 && correctedCategory !== currentCategory
    : true;
  const canSubmit = reasonValid && categoryValid && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    void onSubmit({
      reason: reason as OverrideReason,
      corrected_category: correctedCategory || undefined,
      corrected_branch: correctedBranch || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={backdropStyle}
      onClick={onCancel}
    >
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} style={titleStyle}>
          Override recommendation
        </h2>
        <p style={subtitleStyle}>
          {currentCategory ? `Current: ${currentCategory}` : null}
          {currentBranch ? ` · branch: ${currentBranch}` : null}
        </p>

        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Reason</legend>
          {(Object.keys(OVERRIDE_REASON_COPY) as OverrideReason[]).map((r) => {
            const meta = OVERRIDE_REASON_COPY[r];
            return (
              <label key={r} style={reasonRowStyle}>
                <input
                  type="radio"
                  name="override-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                <span>
                  <strong style={reasonLabelStyle}>{meta.label}</strong>
                  <span style={reasonDescStyle}>{meta.description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {requiresCategory && (
          <label style={fieldLabelStyle}>
            Corrected category <span style={requiredStyle}>*</span>
            <select
              value={correctedCategory}
              onChange={(e) => setCorrectedCategory(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select the correct category…</option>
              {CATEGORY_VALUES.filter((c) => c !== currentCategory).map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
            {currentCategory && correctedCategory === currentCategory && (
              <span style={errorHintStyle}>
                Must differ from the current category.
              </span>
            )}
          </label>
        )}

        <label style={fieldLabelStyle}>
          Corrected branch <span style={optionalStyle}>(optional)</span>
          <input
            type="text"
            value={correctedBranch}
            onChange={(e) => setCorrectedBranch(e.target.value)}
            placeholder={
              currentBranch
                ? `e.g., alternate to '${currentBranch}'`
                : 'e.g., true_duplicate, ambiguous, etc.'
            }
            style={inputStyle}
          />
        </label>

        <label style={fieldLabelStyle}>
          Notes <span style={optionalStyle}>(optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What did you do instead, or what did the tool miss?"
            style={textareaStyle}
          />
          <span style={charCountStyle}>{notes.length}/1000</span>
        </label>

        <div style={actionsStyle}>
          <button type="button" onClick={onCancel} style={cancelBtnStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              ...submitBtnStyle,
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit override'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 12,
  width: 520,
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 500,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
};

const fieldsetStyle: React.CSSProperties = {
  border: '1px solid var(--tw-color-border)',
  borderRadius: 8,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const legendStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  padding: '0 6px',
};

const reasonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  fontSize: '0.875rem',
  alignItems: 'flex-start',
  cursor: 'pointer',
};

const reasonLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 500,
  marginBottom: 2,
};

const reasonDescStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
  lineHeight: 1.4,
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.875rem',
  fontWeight: 500,
};

const requiredStyle: React.CSSProperties = {
  color: 'var(--tw-color-red-700)',
};

const optionalStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
  fontWeight: 400,
  fontSize: '0.75rem',
};

const errorHintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--tw-color-red-700)',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 6,
  fontSize: '0.875rem',
  fontWeight: 400,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 6,
  fontSize: '0.875rem',
  fontWeight: 400,
};

const textareaStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 6,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  fontWeight: 400,
  resize: 'vertical',
};

const charCountStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--tw-color-text-muted)',
  alignSelf: 'flex-end',
  fontWeight: 400,
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 4,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const submitBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--tw-color-teal-600)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.875rem',
  fontWeight: 500,
};
