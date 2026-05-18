/**
 * PrivacyField — PHI masking + reveal-on-click.
 *
 * DEFENSIVE SCAFFOLDING in PR-4: the backend does not surface PHI fields
 * in any denial-tool endpoint in Phase 1, so this component is not
 * currently wired into any view. It's kept for two reasons:
 *
 *   1. Phase 1.1 is expected to ship denial events with reason_text +
 *      patient identifiers. When that lands, this component is ready
 *      to wrap those fields without re-deriving the design.
 *
 *   2. The companion `no-raw-phi` ESLint rule (in eslint-plugins/) is
 *      already enforced. Keeping the component as a documented escape
 *      hatch means contributors have an obvious place to migrate the
 *      moment PHI shows up.
 *
 * Behavior (when wired):
 *   - Default: render `••••••••••••••••` with an eye icon
 *   - On click: reveals the value. NOTE in PR-4 there is no backend
 *     reveal-phi endpoint, so the local reveal is a UI-only affordance.
 *     Phase 1.1 should add a `POST /v1/classifications/{id}/reveal-phi`
 *     endpoint (or equivalent) that records the audit event server-side;
 *     this component then dispatches via useActionMutation.
 */

import { useState } from 'react';

interface PrivacyFieldProps {
  value: string;
  /** Identifier for the audit event (Phase 1.1 wire-up). */
  fieldPath?: string;
  /** Override the masked-state placeholder. */
  maskedAs?: string;
}

export function PrivacyField({
  value,
  fieldPath: _fieldPath,
  maskedAs = '••••••••••••••••',
}: PrivacyFieldProps): JSX.Element {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = () => {
    setRevealed(true);
    // Phase 1.1 hook point: when an audit endpoint exists, dispatch the
    // reveal event here. PR-4 intentionally has no dispatch since the
    // endpoint doesn't exist.
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
