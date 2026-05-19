/**
 * PrivacyField — PHI masking + reveal-on-click + audit dispatch.
 *
 * PR-5 wire-up: the reveal-phi endpoint exists now (Phase 1.5), so this
 * component dispatches an audit event on the first reveal. Behavior:
 *
 *   1. Initial render: masked (`••••••••••••••••` + eye icon).
 *   2. First click: reveal locally AND fire `denial.reveal-phi`.
 *      The reveal is INSTANT — we don't block on the audit call.
 *      If the audit fails, we log it but don't unhide. HIPAA cares
 *      about the audit being LOGGED, not whether the UX waited for it.
 *   3. Subsequent renders: stays revealed (component-local state).
 *
 * field_path conventions (used by the backend's audit reports to group):
 *   - "claim.patient_name"
 *   - "claim.mrn"
 *   - "denial_event:{event_id}.reason_text"
 *
 * Free-text on the backend by design. Use the suggested conventions
 * unless there's a good reason not to.
 */

import { useState } from 'react';
import { useActionMutation } from '@tensaw/actions';
import type { RevealPhiPurpose } from '../actions/schemas';

interface PrivacyFieldProps {
  value: string;
  /** Required for audit dispatch — the classification context for this reveal. */
  classificationId: string;
  /** Audit identifier for this field, e.g. "claim.patient_name". */
  fieldPath: string;
  /** Audit purpose. Defaults to 'worklist_review'. */
  purpose?: RevealPhiPurpose;
  /** Override the masked placeholder. */
  maskedAs?: string;
}

export function PrivacyField({
  value,
  classificationId,
  fieldPath,
  purpose = 'worklist_review',
  maskedAs = '••••••••••••••••',
}: PrivacyFieldProps): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const [mutateReveal] = useActionMutation('denial.reveal-phi');

  const handleReveal = () => {
    setRevealed(true);
    // Fire-and-forget. Don't await; don't unhide on failure.
    mutateReveal({
      classification_id: classificationId,
      field_path: fieldPath,
      purpose,
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.error.message);
      })
      .catch((err: unknown) => {
        // Log only — don't block the analyst's view.
         
        console.warn(
          '[PrivacyField] reveal-phi audit failed (reveal still shown to user):',
          err,
        );
      });
  };

  if (revealed) {
    return <span style={revealedStyle}>{value}</span>;
  }
  return (
    <span style={containerStyle}>
      <span style={maskedStyle}>{maskedAs}</span>
      <button
        type="button"
        onClick={handleReveal}
        style={eyeButtonStyle}
        aria-label="Reveal PHI value (audited)"
        title="Reveal PHI (audited)"
      >
        👁
      </button>
    </span>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const maskedStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
  letterSpacing: '0.05em',
};

const revealedStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-primary)',
};

const eyeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--tw-color-text-muted)',
  fontSize: '0.8125rem',
  padding: 0,
  opacity: 0.7,
};
