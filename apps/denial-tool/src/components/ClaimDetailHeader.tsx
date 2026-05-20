/**
 * ClaimDetailHeader — fat-row claim payload above the 3-region detail.
 *
 * PR-6: platform Pill for ICD/CPT code badges, wrapper PrivacyField
 * for patient_name + mrn, formatMoney() for the decimal-string financial
 * fields, Tailwind classes throughout.
 *
 * Money fields arrive from the backend as decimal-strings (e.g. "574.50",
 * "1436.25") — we format for display without re-parsing through floats.
 * The platform's MoneyField is an input component, not a display
 * primitive, so we keep the inline formatter here.
 */

import { Pill, Spinner, Alert } from '@tensaw/design-system/feedback';
import type { ClaimDetail } from '../actions/schemas';
import { PrivacyField } from './PrivacyField';

interface ClaimDetailHeaderProps {
  detail: ClaimDetail | undefined;
  loading?: boolean;
  classificationId: string;
}

/**
 * Format a decimal-string ("574.50") as USD. Falls back to em-dash on
 * null/empty. Doesn't re-parse through float — splits on the decimal
 * point and inserts thousands separators on the integer part.
 */
function formatMoney(value: string | null | undefined): string {
  if (!value) return '—';
  const [intPart, decPart = '00'] = value.split('.');
  const sign = intPart!.startsWith('-') ? '-' : '';
  const digits = sign ? intPart!.slice(1) : intPart!;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decDisplay = decPart.padEnd(2, '0').slice(0, 2);
  return `${sign}$${grouped}.${decDisplay}`;
}

export function ClaimDetailHeader({
  detail,
  loading,
  classificationId,
}: ClaimDetailHeaderProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-secondary py-4">
        <Spinner size="sm" /> Loading claim detail…
      </div>
    );
  }
  if (!detail) {
    return (
      <Alert variant="warning" tone="subtle">
        Could not load claim detail.
      </Alert>
    );
  }

  return (
    <div className="bg-primary px-4 py-3 border-b border-tertiary flex flex-col gap-3">
      {/* Patient + provider row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-secondary font-medium mb-1">
            Patient
          </div>
          <div className="text-sm mb-0.5">
            <PrivacyField
              value={detail.patient_name}
              classificationId={classificationId}
              fieldPath="claim.patient_name"
              purpose="worklist_review"
            />
          </div>
          <div className="text-xs text-secondary">
            MRN{' '}
            <PrivacyField
              value={detail.mrn}
              classificationId={classificationId}
              fieldPath="claim.mrn"
              purpose="worklist_review"
            />{' '}
            · DOS {detail.dos ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-secondary font-medium mb-1">
            Provider · facility
          </div>
          <div className="text-sm mb-0.5">
            {detail.rendering_provider_name ?? detail.provider_name ?? '—'}
          </div>
          <div className="text-xs text-secondary">
            {detail.facility_name ?? '—'}
            {detail.facility_id ? ` · facility #${detail.facility_id}` : ''}
          </div>
        </div>
      </div>

      {/* Financial breakdown */}
      <div className="pt-2.5 border-t border-tertiary border-dashed">
        <div className="text-[10px] uppercase tracking-wide text-secondary font-medium mb-2">
          Financial
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-xs tabular-nums">
          <div>
            <div className="text-secondary text-[10px]">Billed</div>
            <div className="font-medium">{formatMoney(detail.billed)}</div>
          </div>
          <div>
            <div className="text-secondary text-[10px]">Pri. paid</div>
            <div>{formatMoney(detail.primary_paid)}</div>
          </div>
          <div>
            <div className="text-secondary text-[10px]">Sec. paid</div>
            <div>{formatMoney(detail.secondary_paid)}</div>
          </div>
          <div>
            <div className="text-secondary text-[10px]">Pt. paid</div>
            <div>{formatMoney(detail.patient_paid)}</div>
          </div>
          <div>
            <div className="text-teal-900 text-[10px] font-medium">
              Net pending
            </div>
            <div className="font-medium text-teal-700">
              {formatMoney(detail.net_pending)}
            </div>
          </div>
        </div>
      </div>

      {/* ICD + CPT pills */}
      <div className="flex gap-1.5 flex-wrap items-center text-xs">
        <span className="text-[10px] uppercase tracking-wide text-secondary font-medium mr-1">
          ICD
        </span>
        {detail.icd_codes.length === 0 ? (
          <span className="text-secondary">—</span>
        ) : (
          detail.icd_codes.map((code) => (
            <Pill key={`icd-${code}`} variant="subtle">
              <code className="font-mono text-xs">{code}</code>
            </Pill>
          ))
        )}
        <span className="text-[10px] uppercase tracking-wide text-secondary font-medium ml-3 mr-1">
          CPT
        </span>
        {detail.cpt_lines.length === 0 ? (
          <span className="text-secondary">—</span>
        ) : (
          detail.cpt_lines.map((code) => (
            <Pill key={`cpt-${code}`} variant="subtle">
              <code className="font-mono text-xs">{code}</code>
            </Pill>
          ))
        )}
      </div>
    </div>
  );
}
