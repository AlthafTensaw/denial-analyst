/**
 * Worklist column cell renderers — PR-4 rewrite for the {claim,
 * classification} row shape.
 *
 * Key differences from PR-3:
 *   - Row payload is `{claim: ClaimSummary, classification: Classification}`,
 *     not the old flat RecommendationRow. All renderers reach into one
 *     of the two halves.
 *   - Money fields (`net_pending`, `amount`) are decimal strings on the
 *     wire. Render as-is for display; Number() for comparisons.
 *   - ClaimIdCell shows a CurrentStatusBadge when current_status_label !=
 *     "Denied" — visible cue for the D-13 worked-outside-tool path.
 *   - Status (was: `row.status`) → `row.classification.state`.
 *   - Sort indicators removed — backend imposes a fixed sort.
 */

import type { WorklistRow } from '../../actions/schemas';
import { AgingChip } from '../../components/AgingChip';
import { ConfidenceDot } from '../../components/ConfidenceDot';
import { CurrentStatusBadge } from '../../components/CurrentStatusBadge';
import { PriorityChipsCell } from '../../components/PriorityChip';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

/** Format a backend Decimal-string as $X,XXX.XX. */
function formatMoneyString(decimalString: string): string {
  const n = Number(decimalString);
  if (Number.isNaN(n)) return decimalString;
  return moneyFmt.format(n);
}

/** Compare a backend Decimal-string against a numeric threshold. */
function moneyGte(decimalString: string, threshold: number): boolean {
  const n = Number(decimalString);
  if (Number.isNaN(n)) return false;
  return n >= threshold;
}

function formatDateShort(iso: string): string {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  return `${m}/${d}/${y!.slice(2)}`;
}

function formatMonthDay(iso: string): string {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  return `${parts[1]}/${parts[2]}`;
}

function daysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00Z').getTime();
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

export function PriorityCell({ row }: { row: WorklistRow }) {
  return <PriorityChipsCell chips={row.classification.priority_chips} />;
}

/**
 * Claim id + status badge. The badge surfaces D-13 worked-outside-tool
 * candidates: claims with `current_status_label != "Denied"`.
 */
export function ClaimIdCell({ row }: { row: WorklistRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          color: 'var(--tw-color-teal-700)',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}
      >
        {row.claim.claim_id}
      </span>
      <CurrentStatusBadge label={row.claim.current_status_label} />
    </div>
  );
}

export function PayerCell({ row }: { row: WorklistRow }) {
  const full = row.claim.primary_payer_name ?? '';
  const display = truncate(full, 22);
  return (
    <span title={display === full ? undefined : full}>
      {display || (
        <span style={{ color: 'var(--tw-color-text-muted)' }}>—</span>
      )}
    </span>
  );
}

export function NetPendingCell({ row }: { row: WorklistRow }) {
  const isHighDollar = moneyGte(row.claim.net_pending, 750);
  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: isHighDollar ? 500 : 400,
      }}
    >
      {formatMoneyString(row.claim.net_pending)}
    </span>
  );
}

export function DosAgingCell({ row }: { row: WorklistRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatDateShort(row.claim.dos)}
      </span>
      <AgingChip bucket={row.claim.aging_bucket} />
    </div>
  );
}

/**
 * Recommendation cell — category name + colored confidence dot + sub-line.
 */
export function RecommendationCell({ row }: { row: WorklistRow }) {
  const c = row.classification;
  const subline = [
    row.claim.primary_payer_name,
    row.claim.aging_bucket,
    c.classification_source === 'rule' ? (c.rule_id ?? 'rule') : 'LLM',
  ]
    .filter((v): v is string => Boolean(v))
    .join(' · ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 500,
        }}
      >
        <ConfidenceDot confidence={c.confidence} />
        <span>{c.primary_category}</span>
      </div>
      <span
        style={{
          color: 'var(--tw-color-text-muted)',
          fontSize: '0.75rem',
        }}
      >
        {subline}
      </span>
    </div>
  );
}

/**
 * Next action cell — first workflow step's `action`, owner+SLA sub-line.
 * Workflow steps may be empty for categories without a published workflow;
 * in that case render the placeholder.
 */
export function NextActionCell({ row }: { row: WorklistRow }) {
  const first = row.classification.workflow_steps[0];

  if (!first) {
    return (
      <span
        style={{
          color: 'var(--tw-color-text-muted)',
          fontStyle: 'italic',
          fontSize: '0.8125rem',
        }}
      >
        No action steps defined yet
      </span>
    );
  }

  const slaDate = row.classification.sla_next_action_date;
  const slaDelta = daysUntil(slaDate);
  const slaColor =
    slaDelta < 0
      ? 'var(--tw-color-red-700)'
      : slaDelta <= 3
        ? 'var(--tw-color-amber-700)'
        : 'var(--tw-color-text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span title={first.action}>{truncate(first.action, 80)}</span>
      <span
        style={{
          color: 'var(--tw-color-text-muted)',
          fontSize: '0.75rem',
        }}
      >
        {row.classification.recommended_owner} ·{' '}
        <span style={{ color: slaColor }}>
          SLA {formatMonthDay(slaDate)}
          {slaDelta < 0 ? ` (${Math.abs(slaDelta)}d past)` : ''}
        </span>
      </span>
    </div>
  );
}
