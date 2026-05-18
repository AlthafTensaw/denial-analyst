/**
 * ConfidenceDot — colored dot for high/medium/low confidence.
 * Unchanged from PR-2; backend enum is the same 3 values.
 */

import type { Confidence } from '../actions/schemas';

const COLOR: Record<Confidence, string> = {
  high: 'var(--tw-color-brand-primary)',
  medium: 'var(--tw-color-amber-600)',
  low: 'var(--tw-color-text-danger)',
};

const LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

interface ConfidenceDotProps {
  confidence: Confidence;
  size?: number;
}

export function ConfidenceDot({
  confidence,
  size = 8,
}: ConfidenceDotProps): JSX.Element {
  return (
    <span
      role="img"
      aria-label={LABEL[confidence]}
      title={LABEL[confidence]}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: COLOR[confidence],
        verticalAlign: 'middle',
      }}
    />
  );
}
