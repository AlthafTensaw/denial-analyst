/**
 * CurrentStatusBadge — Primrose claim STATUS surfacing per D-13.
 *
 * The worklist contains claims with any denial event in the last 12 months
 * regardless of current STATUS. When `current_status_label != "Denied"`,
 * an analyst likely worked the claim outside the tool — surface that with
 * a colored badge so it's visible at a glance.
 *
 * Color suggestions are from the handoff doc:
 *   Denied        → no badge (default state)
 *   Filed         → yellow  (re-filed but not yet denied again)
 *   Clari Opened  → orange  (analyst started clarification)
 *   Clari Closed  → green   (cleared)
 *   Pat Balance   → blue    (moved to patient)
 *   Closed        → gray
 *
 * Other labels render as a neutral gray badge — robust to backend
 * additions.
 */

interface CurrentStatusBadgeProps {
  label: string | null;
}

const KNOWN_STYLES: Record<string, { bg: string; fg: string }> = {
  Filed: {
    bg: 'var(--tw-color-status-warning-bg, #FFFBEB)',
    fg: 'var(--tw-color-status-warning-fg, #D97706)',
  },
  'Clari Opened': {
    bg: 'var(--tw-color-status-warning-bg, #FFFBEB)',
    fg: 'var(--tw-color-status-warning-fg, #D97706)',
  },
  'Clari Closed': {
    bg: 'var(--tw-color-status-success-bg, #ECFDF5)',
    fg: 'var(--tw-color-status-success-fg, #059669)',
  },
  'Pat Balance': {
    bg: 'var(--tw-color-status-info-bg, #EFF6FF)',
    fg: 'var(--tw-color-status-info-fg, #2563EB)',
  },
  Closed: {
    bg: 'var(--tw-color-border-muted, #E5E7EB)',
    fg: 'var(--tw-color-text-secondary, #4B5563)',
  },
};

const FALLBACK = {
  bg: 'var(--tw-color-surface-muted, #F9FAFB)',
  fg: 'var(--tw-color-text-secondary, #4B5563)',
};

export function CurrentStatusBadge({
  label,
}: CurrentStatusBadgeProps): JSX.Element | null {
  // "Denied" or missing → no badge (default case)
  if (!label || label === 'Denied') return null;
  const s = KNOWN_STYLES[label] ?? FALLBACK;
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: '0.7rem',
        fontWeight: 500,
        background: s.bg,
        color: s.fg,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
      title={`Current claim status: ${label}`}
    >
      {label}
    </span>
  );
}
