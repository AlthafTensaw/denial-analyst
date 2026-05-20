/**
 * PrivacyField — denial-tool wrapper around the platform PrivacyField.
 *
 * PR-6: replaces the custom PR-5 implementation with the platform
 * component from `@tensaw/design-system/rcm/privacy`. The platform
 * component owns the mask/reveal mechanics, the 30s auto-remask
 * (HIPAA time-bound exposure), permission gating, and a11y. This
 * wrapper adds two things on top:
 *
 *   1. Adapter between the platform's structured audit signature
 *      ({ recordType, recordId, fieldKey }) and the denial-tool
 *      backend's free-text `field_path` + `purpose` convention.
 *   2. The dispatch itself — fire-and-forget POST to
 *      /v1/classifications/{id}/reveal-phi.
 *
 * The dispatch is fire-and-forget by HIPAA design: the audit must
 * happen server-side; failure to record does not block the analyst's
 * view of the data. We log errors but never block.
 */

import { PrivacyField as PlatformPrivacyField } from '@tensaw/design-system/rcm';
import { TextField } from '@tensaw/design-system/primitives';
import { IconButton } from '@tensaw/design-system/primitives';
import { useActionMutation } from '@tensaw/actions';
import type { RevealPhiPurpose } from '../actions/schemas';
import { usePermissions } from '../auth/permissions';

interface DenialPrivacyFieldProps {
  /** The plaintext value to be masked. */
  value: string | null | undefined;
  /** classification_id this field is associated with (for audit). */
  classificationId: string;
  /**
   * Free-text field_path the backend logs. Use the conventions:
   *   "claim.patient_name"
   *   "claim.mrn"
   *   "denial_event:{event_id}.carc.{code}.reason_text"
   *   "denial_event:{event_id}.rarc.{code}.reason_text"
   */
  fieldPath: string;
  /** Why the analyst is revealing — for audit aggregation. */
  purpose?: RevealPhiPurpose;
  /** Override visual rendering. Default: inline text + eye icon. */
  className?: string;
}

/**
 * Default mask: 9 dots regardless of input length so PHI length isn't
 * leakable from the mask itself.
 */
const maskFn = (_value: string) => '•••••••••';

export function PrivacyField({
  value,
  classificationId,
  fieldPath,
  purpose = 'worklist_review',
  className,
}: DenialPrivacyFieldProps) {
  const { has } = usePermissions();
  const canReveal = has('denial.read'); // baseline permission gates reveal

  const [fire] = useActionMutation('denial.reveal-phi');

  // Empty-value short-circuit: render an em-dash, no mask needed.
  if (!value) {
    return <span className={className}>—</span>;
  }

  // Map the platform's structured audit signature to the backend's
  // free-text field_path. The recordId we pass to the platform
  // component is the classification_id (the audit anchor); recordType
  // is constant for this app; fieldKey is the leaf segment of the
  // field path (the bit that varies per-field).
  const fieldKey = fieldPath.split('.').slice(-1)[0] ?? 'unknown';

  const handleReveal = () => {
    fire({
      classificationId,
      body: { field_path: fieldPath, purpose },
    }).catch((err) => {
      // Fire-and-forget per HIPAA minimum-necessary: the audit must
      // happen server-side, but failure here doesn't block the
      // analyst's view. Log for debugging.
      // eslint-disable-next-line no-console
      console.warn('reveal-phi audit dispatch failed', err);
    });
  };

  return (
    <PlatformPrivacyField
      value={value}
      maskFn={maskFn}
      fieldKey={fieldKey}
      recordType="classification"
      recordId={classificationId}
      canReveal={canReveal}
      onReveal={handleReveal}
      render={({ displayValue, isRevealed, toggleReveal, canReveal: gateOk }) => (
        <span className={className}>
          <span className={isRevealed ? 'font-mono' : 'tracking-wider'}>
            {displayValue}
          </span>
          {gateOk ? (
            <IconButton
              icon={isRevealed ? 'eye-off' : 'eye'}
              size="sm"
              variant="ghost"
              ariaLabel={isRevealed ? 'Hide PHI' : 'Reveal PHI'}
              onClick={toggleReveal}
              className="ml-1"
            />
          ) : null}
        </span>
      )}
    />
  );
}
