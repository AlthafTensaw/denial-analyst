/**
 * Denial Tool — 50-row fixture for MSW (PR-5).
 *
 * PR-5 change over PR-4: every workflow step now carries
 * `completed_at: null, completed_by: null` (Phase 1.5 fields). Default-null
 * is backward compatible — older code that doesn't know these fields will
 * still parse cleanly.
 *
 * Patched from PR-4's recommendations.ts via in-place sed; preserves the
 * 50-row dataset (wrong-payer + duplicate + D-13 worked-outside-tool +
 * stage-2 LLM + re-denial scenarios, plus accepted/overridden/completed
 * batches).
 */

import type {
  Classification,
  ClaimSummary,
  WorkflowStep,
  WorklistRow,
} from '../../schemas/denial';

const TOOL_VERSION = 'phase1-0.1.0';
const TRAINING_GUIDE_VERSION = 'v3.0';

// Anchored date so the fixture is stable across renders/tests.
const ANCHOR_MS = new Date('2026-05-17T00:00:00Z').getTime();

const PAYERS = [
  'Medicare TX',
  'BCBS Texas',
  'United Healthcare',
  'Aetna Better Health',
  'Cigna HealthSpring',
  'Humana Gold Plus',
  'Tricare West',
] as const;

const CLINICS = ['LSAT', 'PRIM_BHM', 'PRIM_NSH'] as const;

// ---------------------------------------------------------------------------
// Workflow step fixtures
// ---------------------------------------------------------------------------

const WORKFLOW_WRONG_PAYER: WorkflowStep[] = [
  {
    step: 1,
    action:
      'Identify the correct payer. Check payer remit and pull clinic/facility EMR for latest insurance on file.',
    owner: 'AR → Bhavana',
    sla_days: 3,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 2,
    action:
      'Verify the correct payer through eligibility. Run eligibility on identified payer for DOS.',
    owner: 'AR / Portal team',
    sla_days: 1,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 3,
    action:
      'Refile to correct payer. Submit corrected claim via portal upload or fax. Update insurance in Internal System.',
    owner: 'AR / Resolution',
    sla_days: 1,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 4,
    action:
      'If correct payer cannot be identified, initiate patient outreach in parallel (calls + SMS + letter).',
    owner: 'AR',
    sla_days: 21,
    mode: 'Manual',
    day: 'Day 4-21',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 5,
    action:
      'If patient unresponsive and no correct payer after 30 days, notify Provider and escalate to Iris Liaison.',
    owner: 'AR → Liaison',
    sla_days: 30,
    mode: 'Manual',
    day: 'Day 21+',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 6,
    action: 'If all outreach exhausted, move to patient pending @ cash rate.',
    owner: 'Billing',
    sla_days: 60,
    mode: 'Manual',
    day: 'Day 30+',
    completed_at: null,
    completed_by: null,
  },
];

const WORKFLOW_DUPLICATE: WorkflowStep[] = [
  {
    step: 1,
    action:
      'Investigate prior claim reference. Check Internal System for prior claim on same patient/DOS/CPT.',
    owner: 'AR → Posting',
    sla_days: 2,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 2,
    action: 'Confirm TRUE duplicate — same claim filed twice.',
    owner: 'AR',
    sla_days: 2,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
  {
    step: 3,
    action:
      'Document in Internal System and close. No appeal — denial is correct.',
    owner: 'AR / Billing',
    sla_days: 1,
    mode: 'Manual',
    day: 'Day 0-3',
    completed_at: null,
    completed_by: null,
  },
];

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function isoDate(daysOffset: number): string {
  const d = new Date(ANCHOR_MS + daysOffset * 86400000);
  return d.toISOString().slice(0, 10);
}

function isoDatetime(daysOffset: number, hoursOffset = 0): string {
  const d = new Date(
    ANCHOR_MS + daysOffset * 86400000 + hoursOffset * 3600000,
  );
  return d.toISOString();
}

function agingBucketFor(days: number): string {
  if (days < 30) return '0-29 day';
  if (days < 60) return '30-59 day';
  if (days < 90) return '60-89 day';
  if (days < 120) return '90-119 day';
  if (days < 180) return '120-179 day';
  return '180+ day';
}

/** Map an integer seed to a deterministic v4-shaped UUID. */
function seedUuid(seed: number): string {
  const hex = (seed * 0x9e3779b1).toString(16).padStart(12, '0').slice(0, 12);
  return `1${hex.slice(0, 7)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex}${hex.slice(0, 4)}`.slice(0, 36);
}

interface RowSpec {
  /** Numeric seed for deterministic uuid + claim_id derivation. */
  seed: number;
  claim_id: number;
  primary_category: string;
  training_guide_section?: string;
  classification_source: Classification['classification_source'];
  rule_id?: string | null;
  confidence: Classification['confidence'];
  priority_chips: Classification['priority_chips'];
  risk_flags?: string[];
  workflow_steps?: WorkflowStep[];
  recommended_owner: string;
  reasoning_summary: string;
  branch_chosen?: string | null;
  alternate_categories?: string[];
  requires_human_review?: boolean;
  state?: Classification['state'];

  // Claim-level
  payer_idx: number;
  clinic_idx?: number;
  amount: string; // decimal string
  net_pending: string; // decimal string
  aging_days: number;
  sla_days_from_now: number;
  cpt_lines?: string[];
  appeal_status?: string | null;
  current_status_code?: number | null;
  current_status_label?: string | null;
}

function buildRow(spec: RowSpec): WorklistRow {
  const payer = PAYERS[spec.payer_idx % PAYERS.length]!;
  const clinic = CLINICS[(spec.clinic_idx ?? 0) % CLINICS.length]!;
  const dos = isoDate(-spec.aging_days);
  const sla = isoDate(spec.sla_days_from_now);
  const classifiedAt = isoDatetime(-1, -(spec.seed % 24));

  const classification: Classification = {
    classification_id: seedUuid(spec.seed),
    claim_id: spec.claim_id,
    classified_at: classifiedAt,
    tool_version: TOOL_VERSION,
    training_guide_version: TRAINING_GUIDE_VERSION,
    primary_category: spec.primary_category,
    training_guide_section: spec.training_guide_section ?? null,
    alternate_categories: spec.alternate_categories ?? [],
    classification_source: spec.classification_source,
    rule_id: spec.rule_id ?? null,
    confidence: spec.confidence,
    workflow_steps: spec.workflow_steps ?? [],
    branch_chosen: spec.branch_chosen ?? null,
    recommended_owner: spec.recommended_owner,
    sla_next_action_date: sla,
    priority_chips: spec.priority_chips,
    risk_flags: spec.risk_flags ?? [],
    requires_human_review: spec.requires_human_review ?? false,
    reasoning_summary: spec.reasoning_summary,
    state: spec.state ?? 'recommended',
  };

  const claim: ClaimSummary = {
    claim_id: spec.claim_id,
    clinic,
    primary_payer_name: payer,
    dos,
    amount: spec.amount,
    net_pending: spec.net_pending,
    aging_bucket: agingBucketFor(spec.aging_days),
    cpt_lines: spec.cpt_lines ?? ['99213'],
    appeal_status: spec.appeal_status ?? null,
    current_status_code: spec.current_status_code ?? 5,
    current_status_label: spec.current_status_label ?? 'Denied',
  };

  return { claim, classification };
}

// ===========================================================================
// Specs — 50 rows
// ===========================================================================

const SPECS: RowSpec[] = [
  // ---- Category 02 Wrong Payer, high confidence (6 rows) -------------------
  {
    seed: 1001,
    claim_id: 314785,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary: "Matched rule RULE_CO109_WRONGPAYER on codes ['CO-109'].",
    branch_chosen: 'standard',
    payer_idx: 0,
    amount: '1284.50',
    net_pending: '1284.50',
    aging_days: 22,
    sla_days_from_now: 3,
  },
  {
    seed: 1002,
    claim_id: 314822,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR', 'TF_WATCH'],
    risk_flags: ['within_30d_tfl'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary:
      'CO-109 + claim within 30d of timely-filing window. Escalate.',
    branch_chosen: 'standard',
    payer_idx: 1,
    amount: '945.00',
    net_pending: '945.00',
    aging_days: 145,
    sla_days_from_now: 2,
  },
  {
    seed: 1003,
    claim_id: 314901,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary: "Matched rule RULE_CO109_WRONGPAYER on codes ['CO-109'].",
    branch_chosen: 'standard',
    payer_idx: 2,
    amount: '822.15',
    net_pending: '822.15',
    aging_days: 38,
    sla_days_from_now: 5,
  },
  {
    seed: 1004,
    claim_id: 315020,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: [],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary: "Matched rule RULE_CO109_WRONGPAYER on codes ['CO-109'].",
    branch_chosen: 'standard',
    payer_idx: 3,
    amount: '218.00',
    net_pending: '218.00',
    aging_days: 67,
    sla_days_from_now: 4,
  },
  {
    seed: 1005,
    claim_id: 315118,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'medium',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary:
      'CO-109 plus a secondary CARC that does not map cleanly; medium confidence.',
    branch_chosen: 'standard',
    payer_idx: 4,
    amount: '1100.00',
    net_pending: '1100.00',
    aging_days: 91,
    sla_days_from_now: 1,
  },
  {
    seed: 1006,
    claim_id: 315203,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'medium',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary:
      'Stage 2 LLM picked Wrong Payer from reason-text after rule-engine no-match.',
    branch_chosen: 'standard',
    payer_idx: 5,
    amount: '1530.75',
    net_pending: '1530.75',
    aging_days: 112,
    sla_days_from_now: 6,
  },

  // ---- Category 10 Duplicate (8 rows) --------------------------------------
  {
    seed: 1101,
    claim_id: 348869,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'high',
    priority_chips: ['DUP_INVESTIGATE'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary:
      'Prior denial event on file for same patient/DOS/CPT — true duplicate.',
    branch_chosen: 'true_duplicate',
    payer_idx: 0,
    amount: '412.00',
    net_pending: '412.00',
    aging_days: 19,
    sla_days_from_now: 2,
  },
  {
    seed: 1102,
    claim_id: 348901,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'high',
    priority_chips: ['DUP_INVESTIGATE', 'HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary: 'Duplicate with material balance — confirm + close.',
    branch_chosen: 'true_duplicate',
    payer_idx: 2,
    amount: '1840.00',
    net_pending: '1840.00',
    aging_days: 43,
    sla_days_from_now: 1,
  },
  {
    seed: 1103,
    claim_id: 349014,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'medium',
    priority_chips: ['DUP_INVESTIGATE'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary:
      'Duplicate signal but ambiguous source data — analyst review needed.',
    branch_chosen: 'true_duplicate',
    requires_human_review: true,
    payer_idx: 3,
    amount: '410.00',
    net_pending: '410.00',
    aging_days: 88,
    sla_days_from_now: 2,
  },
  {
    seed: 1104,
    claim_id: 349187,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'high',
    priority_chips: ['DUP_INVESTIGATE'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary: 'Standard duplicate close.',
    branch_chosen: 'true_duplicate',
    payer_idx: 4,
    amount: '198.50',
    net_pending: '198.50',
    aging_days: 31,
    sla_days_from_now: 5,
  },
  {
    seed: 1105,
    claim_id: 349250,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'high',
    priority_chips: ['DUP_INVESTIGATE', 'HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary: 'Duplicate with material balance.',
    branch_chosen: 'true_duplicate',
    payer_idx: 5,
    amount: '925.00',
    net_pending: '925.00',
    aging_days: 102,
    sla_days_from_now: 1,
  },
  {
    seed: 1106,
    claim_id: 349330,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'low',
    priority_chips: ['DUP_INVESTIGATE', 'LOW_CONFIDENCE'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary:
      'Duplicate signal but ambiguous — low-confidence; analyst review needed.',
    branch_chosen: 'true_duplicate',
    requires_human_review: true,
    payer_idx: 6,
    amount: '145.00',
    net_pending: '145.00',
    aging_days: 88,
    sla_days_from_now: 2,
  },
  {
    seed: 1107,
    claim_id: 349420,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'high',
    priority_chips: ['DUP_INVESTIGATE'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary: 'Duplicate close.',
    branch_chosen: 'true_duplicate',
    payer_idx: 0,
    amount: '320.00',
    net_pending: '320.00',
    aging_days: 14,
    sla_days_from_now: 5,
    appeal_status: 'Level 1 Filed',
  },
  {
    seed: 1108,
    claim_id: 349510,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'high',
    priority_chips: ['DUP_INVESTIGATE', 'HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary: 'Duplicate with material balance.',
    branch_chosen: 'true_duplicate',
    payer_idx: 1,
    amount: '1280.00',
    net_pending: '1280.00',
    aging_days: 165,
    sla_days_from_now: -1,
  },

  // ---- D-13 worked-outside-tool path (5 rows; current_status_label != Denied) --
  {
    seed: 1201,
    claim_id: 351001,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary:
      'Wrong-payer rule match — claim already moved to Clari Opened outside tool.',
    branch_chosen: 'standard',
    payer_idx: 0,
    amount: '1850.00',
    net_pending: '1850.00',
    aging_days: 38,
    sla_days_from_now: 3,
    current_status_code: 12,
    current_status_label: 'Clari Opened',
  },
  {
    seed: 1202,
    claim_id: 351088,
    primary_category: '10. Duplicate Claim',
    training_guide_section: '6.7',
    classification_source: 'rule',
    rule_id: 'RULE_18_DUPLICATE',
    confidence: 'high',
    priority_chips: ['DUP_INVESTIGATE'],
    workflow_steps: WORKFLOW_DUPLICATE,
    recommended_owner: 'AR → Posting',
    reasoning_summary: 'Duplicate — already clarified outside tool.',
    branch_chosen: 'true_duplicate',
    payer_idx: 2,
    amount: '420.00',
    net_pending: '420.00',
    aging_days: 51,
    sla_days_from_now: 5,
    current_status_code: 13,
    current_status_label: 'Clari Closed',
  },
  {
    seed: 1203,
    claim_id: 351155,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary: 'Wrong payer — claim was re-filed to correct payer outside tool.',
    branch_chosen: 'standard',
    payer_idx: 3,
    amount: '910.00',
    net_pending: '910.00',
    aging_days: 71,
    sla_days_from_now: 2,
    current_status_code: 3,
    current_status_label: 'Filed',
  },
  {
    seed: 1204,
    claim_id: 351203,
    primary_category: '16. Patient Responsibility (Deductible / Copay / Coinsurance)',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'high',
    priority_chips: [],
    workflow_steps: [],
    recommended_owner: 'Billing',
    reasoning_summary:
      'Patient responsibility — claim already moved to patient balance outside tool.',
    payer_idx: 4,
    amount: '175.00',
    net_pending: '175.00',
    aging_days: 9,
    sla_days_from_now: 5,
    current_status_code: 10,
    current_status_label: 'Pat Balance',
  },
  {
    seed: 1205,
    claim_id: 351299,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: [],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary: 'Wrong payer — claim closed outside tool.',
    branch_chosen: 'standard',
    payer_idx: 5,
    amount: '380.00',
    net_pending: '380.00',
    aging_days: 22,
    sla_days_from_now: 4,
    current_status_code: 11,
    current_status_label: 'Closed',
  },

  // ---- Other categories — mostly Stage-2 LLM with no workflow_steps (10 rows) ---
  {
    seed: 1301,
    claim_id: 401112,
    primary_category: '08. Medical Necessity (Records Needed) — Need to Refile',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'medium',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: [],
    recommended_owner: 'AR',
    reasoning_summary:
      'Stage 2 LLM picked Medical Necessity from reason-text. No workflow defined yet for this category.',
    payer_idx: 2,
    amount: '2150.00',
    net_pending: '2150.00',
    aging_days: 47,
    sla_days_from_now: 3,
  },
  {
    seed: 1302,
    claim_id: 401203,
    primary_category: '04. Coding (documentation needed) - Need to Refile',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'low',
    priority_chips: ['LOW_CONFIDENCE'],
    workflow_steps: [],
    recommended_owner: 'Coding',
    reasoning_summary: 'Reason text matches Coding (docs needed) — low confidence.',
    requires_human_review: true,
    payer_idx: 3,
    amount: '380.00',
    net_pending: '380.00',
    aging_days: 28,
    sla_days_from_now: 4,
  },
  {
    seed: 1303,
    claim_id: 401298,
    primary_category: '09. Eligibility — Patient Not Active',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'medium',
    priority_chips: ['HIGH_DOLLAR', 'TF_WATCH'],
    risk_flags: ['within_30d_tfl'],
    workflow_steps: [],
    recommended_owner: 'AR',
    reasoning_summary: 'Eligibility issue; TFL window approaching.',
    payer_idx: 4,
    amount: '1620.00',
    net_pending: '1620.00',
    aging_days: 158,
    sla_days_from_now: 2,
  },
  {
    seed: 1304,
    claim_id: 401376,
    primary_category: '99. Uncategorized',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'low',
    priority_chips: ['DATA_ERROR'],
    workflow_steps: [],
    recommended_owner: 'AR (Stage 2 LLM failure; manual triage required)',
    reasoning_summary:
      'Stage 2 LLM failed after retries: simulated OpenAI 429 rate-limit.',
    requires_human_review: true,
    payer_idx: 5,
    amount: '720.00',
    net_pending: '720.00',
    aging_days: 65,
    sla_days_from_now: 3,
  },
  {
    seed: 1305,
    claim_id: 401450,
    primary_category: '12. Bundling / NCCI',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR', 'OVERRIDE_PATTERN'],
    risk_flags: ['high_override_rate'],
    workflow_steps: [],
    recommended_owner: 'Coding',
    reasoning_summary:
      'Bundling/NCCI rejection. Note: this category has a high override rate — analyst review recommended.',
    payer_idx: 6,
    amount: '3100.00',
    net_pending: '3100.00',
    aging_days: 51,
    sla_days_from_now: 6,
  },
  {
    seed: 1306,
    claim_id: 401523,
    primary_category: '06. Authorization / Pre-cert',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'medium',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: [],
    recommended_owner: 'AR / Authorization',
    reasoning_summary: 'No auth on file for procedure.',
    payer_idx: 0,
    amount: '1800.00',
    net_pending: '1800.00',
    aging_days: 73,
    sla_days_from_now: 1,
  },
  {
    seed: 1307,
    claim_id: 401698,
    primary_category: '05. Missing or Incorrect Info — Demographic',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'medium',
    priority_chips: [],
    workflow_steps: [],
    recommended_owner: 'AR',
    reasoning_summary: 'Demographic info mismatch on file.',
    payer_idx: 2,
    amount: '540.00',
    net_pending: '540.00',
    aging_days: 84,
    sla_days_from_now: 2,
  },
  {
    seed: 1308,
    claim_id: 401775,
    primary_category: '13. Modifier — Missing or Invalid',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'low',
    priority_chips: ['LOW_CONFIDENCE'],
    workflow_steps: [],
    recommended_owner: 'Coding',
    reasoning_summary: 'Possible modifier issue; coding review needed.',
    requires_human_review: true,
    payer_idx: 3,
    amount: '290.00',
    net_pending: '290.00',
    aging_days: 36,
    sla_days_from_now: 4,
  },
  {
    seed: 1309,
    claim_id: 401850,
    primary_category: '22. Timely Filing — Initial Claim Past Limit',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'high',
    priority_chips: ['TF_WATCH', 'HIGH_DOLLAR'],
    risk_flags: ['within_30d_tfl'],
    workflow_steps: [],
    recommended_owner: 'AR',
    reasoning_summary: 'Inside TFL window — clock is running.',
    payer_idx: 4,
    amount: '1240.00',
    net_pending: '1240.00',
    aging_days: 172,
    sla_days_from_now: 0,
  },
  {
    seed: 1310,
    claim_id: 401930,
    primary_category: '08. Medical Necessity (Records Needed) — Need to Refile',
    classification_source: 'llm',
    rule_id: null,
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: [],
    recommended_owner: 'AR / Clinical',
    reasoning_summary: 'Medical necessity — clinical documentation required.',
    payer_idx: 5,
    amount: '2860.00',
    net_pending: '2860.00',
    aging_days: 124,
    sla_days_from_now: 1,
    appeal_status: 'Level 1 Filed',
  },

  // ---- Re-denial scenario: two classifications, same claim_id (2 rows) -----
  {
    seed: 1401,
    claim_id: 410001,
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary: 'First denial — wrong payer.',
    branch_chosen: 'standard',
    state: 'completed', // older classification, already worked
    payer_idx: 1,
    amount: '950.00',
    net_pending: '950.00',
    aging_days: 95,
    sla_days_from_now: -30,
  },
  {
    seed: 1402,
    claim_id: 410001, // SAME claim_id as above — re-denial scenario
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    classification_source: 'rule',
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high',
    priority_chips: ['HIGH_DOLLAR'],
    workflow_steps: WORKFLOW_WRONG_PAYER,
    recommended_owner: 'AR → Bhavana',
    reasoning_summary: 'Re-denial — payer rejected refile.',
    branch_chosen: 'standard',
    state: 'recommended',
    payer_idx: 1,
    amount: '950.00',
    net_pending: '950.00',
    aging_days: 5,
    sla_days_from_now: 3,
  },

  // ---- accepted / overridden / completed (varied; 19 rows) -----------------
  ...buildBatch(1500, 8, 'accepted'),
  ...buildBatch(1600, 6, 'overridden'),
  ...buildBatch(1700, 5, 'completed'),
];

function buildBatch(
  baseSeed: number,
  count: number,
  state: Classification['state'],
): RowSpec[] {
  const out: RowSpec[] = [];
  for (let i = 0; i < count; i++) {
    const isWrongPayer = i % 2 === 0;
    out.push({
      seed: baseSeed + i,
      claim_id: 500000 + baseSeed + i,
      primary_category: isWrongPayer
        ? '02. Wrong Payer / Misrouted'
        : '10. Duplicate Claim',
      training_guide_section: isWrongPayer ? '6.6' : '6.7',
      classification_source: 'rule',
      rule_id: isWrongPayer ? 'RULE_CO109_WRONGPAYER' : 'RULE_18_DUPLICATE',
      confidence: 'high',
      priority_chips: i % 3 === 0 ? ['HIGH_DOLLAR'] : [],
      workflow_steps: isWrongPayer
        ? WORKFLOW_WRONG_PAYER
        : WORKFLOW_DUPLICATE,
      recommended_owner: isWrongPayer ? 'AR → Bhavana' : 'AR → Posting',
      reasoning_summary: isWrongPayer
        ? 'Wrong payer — standard.'
        : 'Duplicate — standard.',
      branch_chosen: isWrongPayer ? 'standard' : 'true_duplicate',
      state,
      payer_idx: i,
      amount: (250 + i * 137).toFixed(2),
      net_pending: (250 + i * 137).toFixed(2),
      aging_days: 20 + i * 7,
      sla_days_from_now: 3,
    });
  }
  return out;
}

/**
 * PR-5 post-processor: inject `completed_at` + `completed_by` on workflow
 * steps for non-recommended rows so the per-step completion UI has
 * something to show out of the gate in dev.
 *
 * Sequencing strategy:
 *   - state=recommended  → no steps completed (analyst hasn't started)
 *   - state=accepted     → ~30% of steps completed (mid-flight)
 *   - state=overridden   → ~60% of steps completed
 *   - state=completed    → all steps completed
 *
 * Completion timestamps are deterministic, anchored to ANCHOR_MS.
 */
function withStepCompletions(row: WorklistRow, idx: number): WorklistRow {
  const state = row.classification.state;
  if (state === 'recommended') return row;
  const steps = row.classification.workflow_steps;
  if (steps.length === 0) return row;

  let pct: number;
  if (state === 'accepted') pct = 0.3;
  else if (state === 'overridden') pct = 0.6;
  else pct = 1.0; // completed

  const completeCount = Math.max(
    1,
    Math.min(steps.length, Math.round(steps.length * pct)),
  );
  const baseAt = new Date(
    ANCHOR_MS - (24 + idx) * 3600_000,
  ).toISOString();
  const completedBy = 'mock-analyst-sub-renita-k';

  return {
    ...row,
    classification: {
      ...row.classification,
      workflow_steps: steps.map((s, i) =>
        i < completeCount
          ? {
              ...s,
              completed_at: new Date(
                Date.parse(baseAt) + i * 15 * 60_000,
              ).toISOString(),
              completed_by: completedBy,
            }
          : s,
      ),
    },
  };
}

export const WORKLIST_ROWS: WorklistRow[] = SPECS.map(buildRow).map(
  withStepCompletions,
);

/**
 * Static reference data the FE can consume for filter option lists
 * without a backend round-trip. Updates with each fixture version.
 */
export const WORKLIST_FIXTURE_META = {
  payers: Array.from(
    new Set(
      WORKLIST_ROWS.map((r) => r.claim.primary_payer_name).filter(
        (v): v is string => v !== null,
      ),
    ),
  ).sort(),
  recommended_owners: Array.from(
    new Set(WORKLIST_ROWS.map((r) => r.classification.recommended_owner)),
  ).sort(),
} as const;
