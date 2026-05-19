/**
 * PriorityChip — 6 chip kinds matching backend's PriorityChip enum.
 *
 * Removed from PR-2's 11-chip set (consolidated per Day-8):
 *   - DUP_OF_EARLIER, DUP_SIGNAL → merged into DUP_INVESTIGATE
 *   - APPEAL_2, APPEAL_3, REVIEWED → moved to risk_flags / current_status_label
 *   - MULTI_CODE → covered by risk_flags
 *
 * Added:
 *   - OVERRIDE_PATTERN — tool's category has a high override rate;
 *     surfaces when the override-pattern detector flags the row.
 */

import type { PriorityChip as PriorityChipKind } from '../actions/schemas';

interface ChipStyle {
  label: string;
  bg: string;
  fg: string;
  outline?: boolean;
  iconBefore?: string;
}

const CHIP_STYLES: Record<PriorityChipKind, ChipStyle> = {
  TF_WATCH: {
    label: 'TF watch',
    bg: 'var(--tw-color-status-error-bg, #FEF2F2)',
    fg: 'var(--tw-color-status-error-fg, #B91C1C)',
  },
  HIGH_DOLLAR: {
    label: 'High $',
    bg: 'var(--tw-color-status-warning-bg, #FFFBEB)',
    fg: 'var(--tw-color-status-warning-fg, #D97706)',
  },
  LOW_CONFIDENCE: {
    label: 'Low conf',
    bg: 'transparent',
    fg: 'var(--tw-color-status-error-fg, #B91C1C)',
    outline: true,
    iconBefore: '⚠',
  },
  DUP_INVESTIGATE: {
    label: 'Dup — investigate',
    bg: 'var(--tw-color-table-header-bg, #EBF7F6)',
    fg: 'var(--tw-color-brand-header, #149A9A)',
  },
  OVERRIDE_PATTERN: {
    label: 'Override pattern',
    bg: 'var(--tw-color-border-muted, #E5E7EB)',
    fg: 'var(--tw-color-text-secondary, #4B5563)',
  },
  DATA_ERROR: {
    label: 'Data error',
    bg: 'var(--tw-color-status-error-bg, #FEF2F2)',
    fg: 'var(--tw-color-status-error-fg, #B91C1C)',
  },
};

interface PriorityChipProps {
  kind: PriorityChipKind;
}

export function PriorityChip({ kind }: PriorityChipProps): JSX.Element {
  const s = CHIP_STYLES[kind];
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: 1.4,
    background: s.bg,
    color: s.fg,
    border: s.outline ? `1px solid ${s.fg}` : '1px solid transparent',
    whiteSpace: 'nowrap',
  };
  return (
    <span style={style} title={s.label}>
      {s.iconBefore && (
        <span aria-hidden style={{ marginRight: 4 }}>
          {s.iconBefore}
        </span>
      )}
      {s.label}
    </span>
  );
}

interface PriorityChipsCellProps {
  chips: PriorityChipKind[];
}

/**
 * Row-level chip strip: up to 2 chips visible + `+N` overflow.
 */
export function PriorityChipsCell({
  chips,
}: PriorityChipsCellProps): JSX.Element {
  if (chips.length === 0) {
    return (
      <span
        style={{
          color: 'var(--tw-color-text-muted)',
          fontSize: '0.75rem',
        }}
      >
        —
      </span>
    );
  }
  const visible = chips.slice(0, 2);
  const overflow = chips.length - visible.length;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {visible.map((c) => (
        <PriorityChip key={c} kind={c} />
      ))}
      {overflow > 0 && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--tw-color-text-muted)',
          }}
          title={chips.slice(2).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
