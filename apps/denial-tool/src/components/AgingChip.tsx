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
    bg: 'var(--tw-color-gray-100)',
    fg: 'var(--tw-color-gray-700)',
  },
  '30-59 day': {
    bg: 'var(--tw-color-blue-50)',
    fg: 'var(--tw-color-blue-700)',
  },
  '60-89 day': {
    bg: 'var(--tw-color-amber-50)',
    fg: 'var(--tw-color-amber-700)',
  },
  '90-119 day': {
    bg: 'var(--tw-color-amber-100, var(--tw-color-amber-50))',
    fg: 'var(--tw-color-amber-800)',
  },
  '120-179 day': {
    bg: 'var(--tw-color-red-50)',
    fg: 'var(--tw-color-red-700)',
  },
  '180+ day': {
    bg: 'var(--tw-color-red-100, var(--tw-color-red-50))',
    fg: 'var(--tw-color-red-800)',
  },
};

const FALLBACK: BucketStyle = {
  bg: 'var(--tw-color-gray-50)',
  fg: 'var(--tw-color-gray-700)',
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
