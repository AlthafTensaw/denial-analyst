/**
 * Denial-event fixture for GET /v1/claims/{claim_id}/denial-events.
 *
 * Backs the source-evidence region of the row-detail panel. Each event
 * has a procedure_code + arrays of CARC and RARC codes with reason_text.
 *
 * Code selection is keyed to each row's primary_category so the analyst
 * sees a plausible explanation for the tool's classification:
 *   - Wrong Payer (02) → CO-109 (claim/service not covered by this payer)
 *   - Duplicate (10)   → CO-18 + N522 (exact duplicate / duplicate billed)
 *   - Authorization (06) → CO-197 (precert not obtained)
 *   - Medical Necessity (08) → CO-50 (non-covered, not deemed medically necessary)
 *   - etc.
 *
 * `reason_text` is PHI-bearing in production (payer remit can include
 * patient identifiers); the mock-server returns plain strings so the
 * FE's <PrivacyField> + reveal-phi flow exercises end-to-end in dev.
 */

import type { DenialEvent } from '../../schemas/denial';
import { WORKLIST_ROWS } from './recommendations';

// ---------------------------------------------------------------------------
// Code presets per category
// ---------------------------------------------------------------------------

interface CodePreset {
  carc: Array<{ code: string; reason_text: string }>;
  rarc: Array<{ code: string; reason_text: string }>;
}

const PRESETS: Record<string, CodePreset> = {
  '02. Wrong Payer / Misrouted': {
    carc: [
      {
        code: 'CO-109',
        reason_text:
          'Claim/service not covered by this payer/contractor. You must send the claim/service to the correct payer/contractor.',
      },
    ],
    rarc: [
      {
        code: 'N418',
        reason_text: 'Misrouted claim. See the payer Web site for the correct payer ID.',
      },
    ],
  },
  '10. Duplicate Claim': {
    carc: [
      {
        code: '18',
        reason_text: 'Exact duplicate claim/service. Refer to the 835 Healthcare Policy Identification Segment for the rationale.',
      },
    ],
    rarc: [
      {
        code: 'N522',
        reason_text:
          'Duplicate of a claim processed, or to be processed, as a crossover claim.',
      },
    ],
  },
  '06. Authorization / Pre-cert': {
    carc: [
      {
        code: 'CO-197',
        reason_text:
          'Precertification/authorization/notification/pre-treatment absent.',
      },
    ],
    rarc: [],
  },
  '04. Coding (documentation needed) - Need to Refile': {
    carc: [
      {
        code: 'CO-16',
        reason_text:
          'Claim/service lacks information or has submission/billing error(s) which is needed for adjudication.',
      },
    ],
    rarc: [
      {
        code: 'M51',
        reason_text:
          'Missing/incomplete/invalid procedure code(s) and/or dates.',
      },
    ],
  },
  '08. Medical Necessity (Records Needed) — Need to Refile': {
    carc: [
      {
        code: 'CO-50',
        reason_text:
          "Non-covered services because this is not deemed a 'medical necessity' by the payer.",
      },
    ],
    rarc: [
      {
        code: 'N115',
        reason_text:
          'This decision was based on a Local Coverage Determination (LCD).',
      },
    ],
  },
  '09. Eligibility — Patient Not Active': {
    carc: [
      {
        code: 'CO-27',
        reason_text:
          "Expenses incurred after coverage terminated.",
      },
    ],
    rarc: [],
  },
  '12. Bundling / NCCI': {
    carc: [
      {
        code: 'CO-97',
        reason_text:
          'The benefit for this service is included in the payment/allowance for another service/procedure that has already been adjudicated.',
      },
    ],
    rarc: [
      {
        code: 'M80',
        reason_text:
          'Not covered when performed during the same session/date as a previously processed service for the patient.',
      },
    ],
  },
  '13. Modifier — Missing or Invalid': {
    carc: [
      {
        code: 'CO-4',
        reason_text:
          'The procedure code is inconsistent with the modifier used or a required modifier is missing.',
      },
    ],
    rarc: [],
  },
  '22. Timely Filing — Initial Claim Past Limit': {
    carc: [
      {
        code: 'CO-29',
        reason_text:
          'The time limit for filing has expired.',
      },
    ],
    rarc: [],
  },
  '16. Patient Responsibility (Deductible / Copay / Coinsurance)': {
    carc: [
      {
        code: 'PR-1',
        reason_text:
          'Deductible amount.',
      },
      {
        code: 'PR-2',
        reason_text:
          'Coinsurance amount.',
      },
    ],
    rarc: [],
  },
  '05. Missing or Incorrect Info — Demographic': {
    carc: [
      {
        code: 'CO-140',
        reason_text:
          'Patient/Insured health identification number and name do not match.',
      },
    ],
    rarc: [
      {
        code: 'N382',
        reason_text:
          'Missing/incomplete/invalid patient identifier.',
      },
    ],
  },
};

const DEFAULT_PRESET: CodePreset = {
  carc: [
    {
      code: 'CO-16',
      reason_text:
        'Claim/service lacks information or has submission/billing error(s).',
    },
  ],
  rarc: [],
};

// ---------------------------------------------------------------------------
// Build per-claim event lists
// ---------------------------------------------------------------------------

function buildDenialEventsFor(claimId: number): DenialEvent[] {
  const row = WORKLIST_ROWS.find((r) => r.claim.claim_id === claimId);
  if (!row) return [];

  const preset =
    PRESETS[row.classification.primary_category] ?? DEFAULT_PRESET;
  const procCode = row.claim.cpt_lines[0] ?? '99213';

  // Single event for the typical case; the re-denial scenario gets two.
  const isReDenial = claimId === 410001;

  const events: DenialEvent[] = [];

  // Earlier event (the original denial)
  events.push({
    event_id: claimId * 10 + 1,
    occurred_at: addDays(row.claim.dos, 14),
    procedure_id: 1,
    procedure_code: procCode,
    carc_codes: preset.carc,
    rarc_codes: preset.rarc,
    is_deleted: false,
  });

  if (isReDenial) {
    // Re-denial — second event ~30 days after the first
    events.push({
      event_id: claimId * 10 + 2,
      occurred_at: addDays(row.claim.dos, 60),
      procedure_id: 1,
      procedure_code: procCode,
      carc_codes: preset.carc,
      rarc_codes: preset.rarc,
      is_deleted: false,
    });
  }

  return events;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Build map at module init
// ---------------------------------------------------------------------------

const DENIAL_EVENTS_MAP: Map<number, DenialEvent[]> = new Map();
for (const row of WORKLIST_ROWS) {
  DENIAL_EVENTS_MAP.set(
    row.claim.claim_id,
    buildDenialEventsFor(row.claim.claim_id),
  );
}

export function findDenialEvents(claimId: number): DenialEvent[] {
  return DENIAL_EVENTS_MAP.get(claimId) ?? [];
}
