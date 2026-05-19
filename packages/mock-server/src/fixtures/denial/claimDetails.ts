/**
 * Claim-detail fixture for GET /v1/claims/{claim_id}.
 *
 * Provides ClaimDetail records for every claim_id that appears in the
 * worklist fixture. PHI fields are synthetic but realistic-looking;
 * the mock server returns them plain (same as the real backend) so the
 * FE's PrivacyField + reveal-phi flow exercises end-to-end in dev.
 *
 * Financial fields are decimal strings, matching the backend Decimal
 * serializer.
 */

import type { ClaimDetail } from '../../schemas/denial';
import { WORKLIST_ROWS } from './recommendations';

const PROVIDER_NAMES = [
  'Dr. Sarah Patel',
  'Dr. James Wong',
  'Dr. Maria Chen',
  'Dr. David Lee',
  'Dr. Anna Rodriguez',
  'Dr. Michael Singh',
  'Dr. Lisa Thompson',
] as const;

const PATIENT_NAMES = [
  'Doe, Jane',
  'Smith, Robert',
  'Garcia, Maria',
  'Lee, Christopher',
  'Wong, Emily',
  'Brown, Jessica',
  'Johnson, Michael',
  'Davis, Sarah',
] as const;

const CLINIC_DETAILS: Record<
  string,
  { id: number; name: string; facility_id: number; facility_name: string }
> = {
  LSAT: { id: 1001, name: 'Lake Surgical and Aesthetics of Texas', facility_id: 501, facility_name: 'LSAT Main' },
  PRIM_BHM: { id: 1002, name: 'Primrose Birmingham', facility_id: 502, facility_name: 'PRIM BHM Main' },
  PRIM_NSH: { id: 1003, name: 'Primrose Nashville', facility_id: 503, facility_name: 'PRIM NSH Main' },
};

const ICD_PRESETS: Record<string, string[]> = {
  '02. Wrong Payer / Misrouted': ['E11.9', 'I10', 'Z79.4'],
  '10. Duplicate Claim': ['M54.5', 'Z00.00'],
  '06. Authorization / Pre-cert': ['M25.561', 'M25.562'],
  '04. Coding (documentation needed) - Need to Refile': ['E11.65', 'I25.10'],
  '08. Medical Necessity (Records Needed) — Need to Refile': ['C50.911', 'Z85.3'],
  '09. Eligibility — Patient Not Active': ['J45.40', 'R05'],
  '12. Bundling / NCCI': ['M17.11', 'M19.011'],
  '13. Modifier — Missing or Invalid': ['M25.50', 'M79.7'],
  '22. Timely Filing — Initial Claim Past Limit': ['Z12.31', 'N40.0'],
  '16. Patient Responsibility (Deductible / Copay / Coinsurance)': ['I10', 'E78.5'],
  '99. Uncategorized': ['R99'],
  '05. Missing or Incorrect Info — Demographic': ['Z00.00'],
};

const ICD_DEFAULT = ['R69'];

function buildClaimDetail(claimId: number): ClaimDetail | null {
  const row = WORKLIST_ROWS.find((r) => r.claim.claim_id === claimId);
  if (!row) return null;
  const claim = row.claim;
  const classification = row.classification;
  const clinicAlias = claim.clinic ?? 'LSAT';
  const clinic = CLINIC_DETAILS[clinicAlias] ?? CLINIC_DETAILS.LSAT!;
  const providerIdx = claimId % PROVIDER_NAMES.length;
  const patientIdx = claimId % PATIENT_NAMES.length;
  const netPending = Number(claim.net_pending);
  return {
    claim_id: claimId,
    clinic_id: clinic.id,
    clinic_alias: clinicAlias,
    clinic_name: clinic.name,
    dos: claim.dos,
    primary_payer_name: claim.primary_payer_name,
    appeal_status: claim.appeal_status,
    current_status_code: claim.current_status_code ?? 5,
    current_status_label: claim.current_status_label ?? 'Denied',
    aging_bucket: claim.aging_bucket,
    patient_name: PATIENT_NAMES[patientIdx]!,
    mrn: `MRN${String(claimId).padStart(7, '0')}`,
    provider_name: PROVIDER_NAMES[providerIdx]!,
    rendering_provider_name: PROVIDER_NAMES[providerIdx]!,
    facility_id: clinic.facility_id,
    facility_name: clinic.facility_name,
    billed: (netPending * 1.6).toFixed(2),
    primary_paid: (netPending * 0.45).toFixed(2),
    secondary_paid: (netPending * 0.05).toFixed(2),
    tertiary_paid: '0.00',
    patient_paid: (netPending * 0.02).toFixed(2),
    primary_pending: (netPending * 0.7).toFixed(2),
    secondary_pending: (netPending * 0.2).toFixed(2),
    patient_pending: (netPending * 0.1).toFixed(2),
    net_pending: claim.net_pending,
    cpt_lines: claim.cpt_lines,
    icd_codes: ICD_PRESETS[classification.primary_category] ?? ICD_DEFAULT,
  };
}

const CLAIM_DETAILS_MAP: Map<number, ClaimDetail> = new Map();
for (const row of WORKLIST_ROWS) {
  const detail = buildClaimDetail(row.claim.claim_id);
  if (detail) CLAIM_DETAILS_MAP.set(row.claim.claim_id, detail);
}

export function findClaimDetail(claimId: number): ClaimDetail | null {
  return CLAIM_DETAILS_MAP.get(claimId) ?? null;
}
