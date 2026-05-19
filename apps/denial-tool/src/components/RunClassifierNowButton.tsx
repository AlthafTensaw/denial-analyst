/**
 * RunClassifierNowButton — per-claim ad-hoc re-classify.
 *
 * PR-4 change from PR-3: this is no longer a global "run the whole batch
 * now" button. Backend has only `POST /v1/claims/{claim_id}/classify`
 * which is per-claim and manager-only (D-18).
 *
 * Use sites:
 *   - Row-detail panel: "Re-classify this claim" button
 *   - NOT in the empty-state or page header
 *
 * Gating: requires `denial.classify_claim` permission (MANAGER / ADMIN).
 * Hidden entirely when the user lacks the permission rather than disabled,
 * matching D-18's "hide from analysts" directive.
 */

import { useState } from 'react';
import { useActionMutation } from '@tensaw/actions';
import { useAuthStore } from '@tensaw/runtime';
import { friendlyErrorMessage } from '../lib/problem';

interface RunClassifierNowButtonProps {
  claimId: number;
  /** Called after a successful re-classify so the parent can refetch. */
  onSuccess?: () => void;
}

export function RunClassifierNowButton({
  claimId,
  onSuccess,
}: RunClassifierNowButtonProps): JSX.Element | null {
  const user = useAuthStore((s) => s.user);
  const [toast, setToast] = useState<string | null>(null);
  const [mutateReclassify, { isLoading: reclassifyPending }] = useActionMutation('denial.classify-claim');

  // D-18: hide from analysts entirely.
  if (!user?.permissions.includes('denial.classify_claim')) return null;

  const handleClick = async () => {
    try {
      const result = await mutateReclassify({ claim_id: claimId });
      if (!result.ok) throw new Error(result.error.message);
      setToast(`Re-classified claim ${claimId}.`);
      onSuccess?.();
    } catch (err) {
      setToast(`Re-classify failed: ${friendlyErrorMessage(err)}`);
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={reclassifyPending}
        style={btnStyle}
        title="Run classifier against this claim (re-classify against current denial events)"
      >
        {reclassifyPending ? 'Re-classifying…' : 'Re-classify'}
      </button>
      {toast && (
        <div role="status" style={toastStyle}>
          {toast}
          <button
            type="button"
            onClick={() => { setToast(null); }}
            style={toastCloseStyle}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </span>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'transparent',
  color: 'var(--tw-color-brand-header, #149A9A)',
  border: '1px solid var(--tw-color-brand-header, #149A9A)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const toastStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  background: '#1F2937',
  color: 'white',
  padding: '6px 32px 6px 10px',
  borderRadius: 4,
  fontSize: '0.75rem',
  zIndex: 20,
  whiteSpace: 'nowrap',
  maxWidth: 360,
};

const toastCloseStyle: React.CSSProperties = {
  position: 'absolute',
  right: 4,
  top: 2,
  background: 'transparent',
  border: 'none',
  color: 'white',
  fontSize: '1rem',
  lineHeight: 1,
  cursor: 'pointer',
};
