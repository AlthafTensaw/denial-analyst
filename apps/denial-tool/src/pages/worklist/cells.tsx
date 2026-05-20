/**
 * Worklist column cells.
 *
 * PR-6: drops custom <PriorityChip>, <AgingChip>, <CurrentStatusBadge>
 * components — each is now Pill rendered inline with the right tone.
 * ConfidenceDot stays custom (just a 6px colored dot; no platform
 * equivalent). NextActionCell advances through completed steps as
 * PR-5 already wired.
 */

import { Pill } from '@tensaw/design-system/feedback';
import type {
  Confidence,
  PriorityChip as PriorityChipValue,
  WorklistRow,
} from '../../actions/schemas';

// -- Confidence dot (custom — no platform equivalent) -----------------------

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: 'bg-teal-600',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
};

export function ConfidenceDot({ value }: { value: Confidence }) {
  return (
    <span
      className={[
        'inline-block w-2 h-2 rounded-full',
        CONFIDENCE_COLOR[value],
      ].join(' ')}
      aria-label={`${value} confidence`}
      role="img"
    />
  );
}

// -- Priority chip — Pill with per-chip tone --------------------------------

const PRIORITY_TONE: Record<PriorityChipValue, 'amber' | 'red' | 'purple' | 'coral'> = {
  HIGH_DOLLAR: 'amber',
  LOW_CONFIDENCE: 'amber',
  DUP_INVESTIGATE: 'purple',
  TF_WATCH: 'red',
  OVERRIDE_PATTERN: 'coral',
  DATA_ERROR: 'red',
};

function PriorityPill({ value }: { value: PriorityChipValue }) {
  return (
    <Pill
      variant="subtle"
      tone={PRIORITY_TONE[value]}
      className="text-[10px] uppercase tracking-wide"
    >
      {value}
    </Pill>
  );
}

// -- Aging chip — Pill, color depends on bucket -----------------------------

function agingTone(bucket: string | null): 'green' | 'amber' | 'red' | 'gray' {
  if (!bucket) return 'gray';
  if (bucket.startsWith('0-') || bucket.startsWith('30-')) return 'green';
  if (bucket.startsWith('60-') || bucket.startsWith('90-')) return 'amber';
  return 'red'; // 120+, 180+
}

export function AgingCell({ row }: { row: WorklistRow }) {
  const bucket = row.claim.aging_bucket;
  return (
    <Pill variant="subtle" tone={agingTone(bucket) as 'green' | 'amber' | 'red' | 'gray'}>
      {bucket ?? '—'}
    </Pill>
  );
}

// -- Current status badge (D-13) --------------------------------------------

function currentStatusTone(
  label: string | null,
): 'green' | 'blue' | 'amber' | 'gray' {
  if (!label || label === 'Denied') return 'gray';
  if (label === 'Paid' || label === 'Filed') return 'green';
  if (label === 'Clari Opened') return 'amber';
  return 'blue';
}

export function CurrentStatusCell({ row }: { row: WorklistRow }) {
  const label = row.claim.current_status_label;
  if (!label || label === 'Denied') return null; // collapse the noise — Denied is implicit
  return (
    <Pill variant="subtle" tone={currentStatusTone(label) as 'green' | 'blue' | 'amber' | 'gray'}>
      {label}
    </Pill>
  );
}

// -- Claim + patient cell ---------------------------------------------------

export function ClaimPatientCell({ row }: { row: WorklistRow }) {
  return (
    <div>
      <div className="font-medium text-sm">
        {row.claim.claim_id}
        {' · '}
        <span className="text-secondary tracking-wider">•••••••••</span>
      </div>
      <div className="text-xs text-secondary mt-0.5">
        {row.claim.primary_payer_name ?? '—'} · {row.claim.aging_bucket ?? '—'}
      </div>
    </div>
  );
}

// -- Category + chips cell --------------------------------------------------

export function CategoryCell({ row }: { row: WorklistRow }) {
  const c = row.classification;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm">
        <ConfidenceDot value={c.confidence} />
        <span>{c.primary_category}</span>
      </div>
      {c.priority_chips.length > 0 ? (
        <div className="mt-1 flex gap-1 flex-wrap">
          {c.priority_chips.map((chip) => (
            <PriorityPill key={chip} value={chip} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// -- State pill -------------------------------------------------------------

const STATE_TONE = {
  recommended: 'info',
  accepted: 'teal',
  overridden: 'amber',
  completed: 'gray',
} as const;

export function StateCell({ row }: { row: WorklistRow }) {
  const state = row.classification.state;
  return (
    <Pill
      variant="subtle"
      tone={STATE_TONE[state] as 'info' | 'teal' | 'amber' | 'gray'}
    >
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </Pill>
  );
}

// -- Next action cell (PR-5: first incomplete step) -------------------------

export function NextActionCell({ row }: { row: WorklistRow }) {
  const steps = row.classification.workflow_steps;
  const firstIncomplete = steps.find((s) => !s.completed_at);
  const allComplete = steps.length > 0 && !firstIncomplete;

  if (steps.length === 0) {
    return (
      <span className="text-secondary italic text-xs">
        No action steps defined yet
      </span>
    );
  }
  if (allComplete) {
    return (
      <span className="text-teal-700 text-xs font-medium">
        ✓ All steps complete
      </span>
    );
  }
  const next = firstIncomplete!;
  return (
    <div className="text-xs">
      <div className="font-medium">{next.action}</div>
      <div className="text-secondary mt-0.5">
        {next.owner} · {next.sla_days} day SLA
      </div>
    </div>
  );
}

// -- Net pending money cell -------------------------------------------------

export function NetPendingCell({ row }: { row: WorklistRow }) {
  const value = row.claim.net_pending;
  const [intPart, decPart = '00'] = value.split('.');
  const grouped = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (
    <span className="tabular-nums font-medium">
      ${grouped}.{decPart.padEnd(2, '0').slice(0, 2)}
    </span>
  );
}
