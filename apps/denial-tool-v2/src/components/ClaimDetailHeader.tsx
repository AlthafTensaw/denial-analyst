/**
 * ClaimDetailHeader — fat claim-detail render for the row-expand panel.
 *
 * Sourced from GET /v1/claims/{claim_id} (Phase 1.5). Distinct from the
 * thin ClaimSummary the worklist row already has — this surface lives
 * inside the expanded detail panel only.
 *
 * Sections:
 *   - Patient strip: name (PHI) + MRN (PHI) + DOS + clinic/facility
 *   - Provider strip: billing provider + rendering provider
 *   - Financial breakdown: billed → 4 paid (primary/secondary/tertiary/patient)
 *     → 3 pending (primary/secondary/patient) → net pending
 *   - Clinical: CPT lines + ICD codes
 *
 * PHI fields (patient_name, mrn) wrap in PrivacyField which fires the
 * reveal-phi audit when clicked. Use field_path conventions:
 *   - "claim.patient_name"
 *   - "claim.mrn"
 *
 * Financial values are decimal strings; we format with `formatCurrency`
 * but pass the raw string through if formatting fails (paranoid for
 * malformed payer data).
 */

import type { ClaimDetail } from '../actions/schemas';
import { PrivacyField } from './PrivacyField';

interface ClaimDetailHeaderProps {
  detail: ClaimDetail;
  classificationId: string;
  loading?: boolean;
  error?: unknown;
}

export function ClaimDetailHeader({
  detail,
  classificationId,
  loading,
  error,
}: ClaimDetailHeaderProps): JSX.Element {
  if (loading) {
    return <div style={loadingStyle}>Loading claim detail…</div>;
  }
  if (error) {
    return (
      <div style={errorStyle}>
        Couldn't load claim detail. Showing the worklist row data only.
      </div>
    );
  }

  return (
    <section style={containerStyle} aria-label="Claim detail">
      {/* Patient strip ---------------------------------------------------- */}
      <div style={stripStyle}>
        <div style={fieldStyle}>
          <div style={labelStyle}>Patient</div>
          <div style={valueStyle}>
            {detail.patient_name ? (
              <PrivacyField
                value={detail.patient_name}
                classificationId={classificationId}
                fieldPath="claim.patient_name"
              />
            ) : (
              <span style={mutedStyle}>—</span>
            )}
          </div>
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>MRN</div>
          <div style={valueStyle}>
            {detail.mrn ? (
              <PrivacyField
                value={detail.mrn}
                classificationId={classificationId}
                fieldPath="claim.mrn"
              />
            ) : (
              <span style={mutedStyle}>—</span>
            )}
          </div>
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>DOS</div>
          <div style={valueStyle}>{detail.dos ?? <span style={mutedStyle}>—</span>}</div>
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>Clinic / Facility</div>
          <div style={valueStyle}>
            {detail.clinic_alias}
            {detail.facility_name && (
              <span style={mutedInlineStyle}> · {detail.facility_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Provider strip --------------------------------------------------- */}
      <div style={stripStyle}>
        <div style={fieldStyle}>
          <div style={labelStyle}>Billing provider</div>
          <div style={valueStyle}>
            {detail.provider_name ?? <span style={mutedStyle}>—</span>}
          </div>
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>Rendering provider</div>
          <div style={valueStyle}>
            {detail.rendering_provider_name ?? (
              <span style={mutedStyle}>—</span>
            )}
          </div>
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>Payer</div>
          <div style={valueStyle}>
            {detail.primary_payer_name ?? <span style={mutedStyle}>—</span>}
          </div>
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>Appeal status</div>
          <div style={valueStyle}>
            {detail.appeal_status ?? <span style={mutedStyle}>—</span>}
          </div>
        </div>
      </div>

      {/* Financial breakdown --------------------------------------------- */}
      <div style={financialContainerStyle}>
        <div style={financialHeaderStyle}>Financial breakdown</div>
        <div style={financialGridStyle}>
          <FinancialCell label="Billed" value={detail.billed} variant="billed" />
          <FinancialCell label="Primary paid" value={detail.primary_paid} />
          <FinancialCell label="Secondary paid" value={detail.secondary_paid} />
          <FinancialCell label="Tertiary paid" value={detail.tertiary_paid} />
          <FinancialCell label="Patient paid" value={detail.patient_paid} />
          <FinancialCell label="Primary pending" value={detail.primary_pending} />
          <FinancialCell label="Secondary pending" value={detail.secondary_pending} />
          <FinancialCell label="Patient pending" value={detail.patient_pending} />
          <FinancialCell
            label="Net pending"
            value={detail.net_pending}
            variant="net"
          />
        </div>
      </div>

      {/* Clinical --------------------------------------------------------- */}
      <div style={stripStyle}>
        <div style={fieldStyle}>
          <div style={labelStyle}>CPT lines</div>
          <div style={valueStyle}>
            {detail.cpt_lines.length > 0 ? (
              <CodeChips codes={detail.cpt_lines} />
            ) : (
              <span style={mutedStyle}>—</span>
            )}
          </div>
        </div>
        <div style={{ ...fieldStyle, flex: 2 }}>
          <div style={labelStyle}>ICD codes</div>
          <div style={valueStyle}>
            {detail.icd_codes.length > 0 ? (
              <CodeChips codes={detail.icd_codes} />
            ) : (
              <span style={mutedStyle}>—</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface FinancialCellProps {
  label: string;
  value: string | null;
  variant?: 'billed' | 'net' | 'default';
}

function FinancialCell({
  label,
  value,
  variant = 'default',
}: FinancialCellProps): JSX.Element {
  return (
    <div style={financialCellStyle}>
      <div style={financialLabelStyle}>{label}</div>
      <div
        style={
          variant === 'net'
            ? financialValueNetStyle
            : variant === 'billed'
              ? financialValueBilledStyle
              : financialValueStyle
        }
      >
        {value !== null ? formatCurrency(value) : <span style={mutedStyle}>—</span>}
      </div>
    </div>
  );
}

function CodeChips({ codes }: { codes: string[] }): JSX.Element {
  return (
    <div style={chipRowStyle}>
      {codes.map((c) => (
        <code key={c} style={chipStyle}>
          {c}
        </code>
      ))}
    </div>
  );
}

function formatCurrency(decimalString: string): string {
  try {
    const n = Number(decimalString);
    if (!Number.isFinite(n)) return decimalString;
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return decimalString;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  background: 'var(--tw-color-gray-50)',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 8,
};

const stripStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 24,
};

const fieldStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 140,
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--tw-color-text-muted)',
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--tw-color-text-primary)',
};

const mutedStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
};

const mutedInlineStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
  fontSize: '0.8125rem',
};

const financialContainerStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'white',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 6,
};

const financialHeaderStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--tw-color-text-muted)',
  marginBottom: 8,
};

const financialGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 8,
};

const financialCellStyle: React.CSSProperties = {
  padding: '6px 8px',
};

const financialLabelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--tw-color-text-muted)',
  marginBottom: 2,
};

const financialValueStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontFamily: 'ui-monospace, monospace',
  color: 'var(--tw-color-text-primary)',
};

const financialValueBilledStyle: React.CSSProperties = {
  ...financialValueStyle,
  fontWeight: 500,
};

const financialValueNetStyle: React.CSSProperties = {
  ...financialValueStyle,
  fontWeight: 700,
  color: 'var(--tw-color-teal-700)',
};

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
};

const chipStyle: React.CSSProperties = {
  background: 'var(--tw-color-gray-100)',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontFamily: 'ui-monospace, monospace',
};

const loadingStyle: React.CSSProperties = {
  padding: 14,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
};

const errorStyle: React.CSSProperties = {
  padding: 10,
  background: 'var(--tw-color-amber-50)',
  border: '1px solid var(--tw-color-amber-200, var(--tw-color-amber-50))',
  borderRadius: 6,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-amber-800)',
};
