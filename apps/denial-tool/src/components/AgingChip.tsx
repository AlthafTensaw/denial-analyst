/**
 * AgingChip — colored pill for the aging-bucket column.
 *
 * Backend labels include the "day" unit suffix. We map known buckets to
 * a color ramp; unknown values pass through as gray (the wire schema is
 * `string | null` for forward compat).
 */

interface AgingChipProps {
  bucket: string | null;
}

interface BucketStyle {
  bg: string;
  fg: string;
}

const STYLES: Record<string, BucketStyle> = {
  '0-29 day': {
    bg: 'var(--tw-color-surface-muted, #F9FAFB)',
    fg: 'var(--tw-color-text-secondary, #4B5563)',
  },
  '30-59 day': {
    bg: 'var(--tw-color-status-info-bg, #EFF6FF)',
    fg: 'var(--tw-color-status-info-fg, #2563EB)',
  },
  '60-89 day': {
    bg: 'var(--tw-color-status-warning-bg, #FFFBEB)',
    fg: 'var(--tw-color-status-warning-fg, #D97706)',
  },
  '90-119 day': {
    bg: 'var(--tw-color-status-warning-bg, #FFFBEB)',
    fg: 'var(--tw-color-status-warning-fg, #D97706)',
  },
  '120-179 day': {
    bg: 'var(--tw-color-status-error-bg, #FEF2F2)',
    fg: 'var(--tw-color-status-error-fg, #EF4444)',
  },
  '180+ day': {
    bg: 'var(--tw-color-status-error-bg, #FEF2F2)',
    fg: 'var(--tw-color-status-error-fg, #EF4444)',
  },
};

const FALLBACK: BucketStyle = {
  bg: 'var(--tw-color-surface-muted, #F9FAFB)',
  fg: 'var(--tw-color-text-secondary, #4B5563)',
};

export function AgingChip({ bucket }: AgingChipProps): JSX.Element {
  if (!bucket) {
    return (
      <span
        style={{
          color: 'var(--tw-color-text-muted)',
          fontSize: '0.7rem',
        }}
      >
        —
      </span>
    );
  }
  const s = STYLES[bucket] ?? FALLBACK;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: '0.7rem',
        fontWeight: 500,
        background: s.bg,
        color: s.fg,
        lineHeight: 1.4,
      }}
    >
      {bucket}
    </span>
  );
}
