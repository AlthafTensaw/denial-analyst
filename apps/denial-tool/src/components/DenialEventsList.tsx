/**
 * DenialEventsList — source-evidence region.
 *
 * Renders the §6.6 region 2 content per the original tech spec, wired to
 * GET /v1/claims/{claim_id}/denial-events. Each event has procedure code,
 * occurred date, and arrays of CARC + RARC codes with reason_text. The
 * `reason_text` is PHI — wrapped in PrivacyField with the audit endpoint.
 *
 * Layout per event:
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ 2026-02-29 · CPT 99213 · event #1001401              │
 *   │   CARCs:                                             │
 *   │     • CO-109   [view reason]                         │
 *   │   RARCs:                                             │
 *   │     • N418     [view reason]                         │
 *   └──────────────────────────────────────────────────────┘
 *
 * Multiple events render in chronological order (most recent last). Hides
 * deleted events (is_deleted=true) — they're surfaced separately to
 * managers in the Phase-2 audit view.
 */

import type { DenialEvent, DenialEventCode } from '../actions/schemas';
import { PrivacyField } from './PrivacyField';

interface DenialEventsListProps {
  classificationId: string;
  events: DenialEvent[];
  loading?: boolean;
  error?: unknown;
}

export function DenialEventsList({
  classificationId,
  events,
  loading,
  error,
}: DenialEventsListProps): JSX.Element {
  if (loading) {
    return <div style={loadingStyle}>Loading denial events…</div>;
  }
  if (error) {
    return (
      <div style={errorStyle}>
        Couldn't load denial events. The claim may have no denial history
        on file.
      </div>
    );
  }
  const visible = events.filter((e) => !e.is_deleted);
  if (visible.length === 0) {
    return (
      <div style={emptyStyle}>
        No denial events on file for this claim. The classification was
        likely produced from other signals (manual entry, retry, etc.).
      </div>
    );
  }

  // Chronological — most recent first for analyst scanning
  const sorted = [...visible].sort(
    (a, b) =>
      new Date(b.occurred_at ?? 0).getTime() -
      new Date(a.occurred_at ?? 0).getTime(),
  );

  return (
    <div style={listStyle}>
      {sorted.map((event) => (
        <article key={event.event_id} style={eventCardStyle}>
          <header style={eventHeaderStyle}>
            <strong>{event.occurred_at ?? 'Unknown date'}</strong>
            {event.procedure_code && (
              <>
                <span style={dividerStyle}>·</span>
                <span>
                  CPT <code>{event.procedure_code}</code>
                </span>
              </>
            )}
            <span style={dividerStyle}>·</span>
            <span style={eventIdStyle}>event #{event.event_id}</span>
          </header>
          <div style={codeSectionsStyle}>
            <CodeSection
              label="CARCs"
              codes={event.carc_codes}
              classificationId={classificationId}
              eventId={event.event_id}
              kind="carc"
            />
            <CodeSection
              label="RARCs"
              codes={event.rarc_codes}
              classificationId={classificationId}
              eventId={event.event_id}
              kind="rarc"
            />
          </div>
        </article>
      ))}
    </div>
  );
}

interface CodeSectionProps {
  label: string;
  codes: DenialEventCode[];
  classificationId: string;
  eventId: number;
  kind: 'carc' | 'rarc';
}

function CodeSection({
  label,
  codes,
  classificationId,
  eventId,
  kind,
}: CodeSectionProps): JSX.Element {
  if (codes.length === 0) {
    return (
      <div style={codeSectionStyle}>
        <div style={codeSectionLabelStyle}>{label}</div>
        <div style={codeSectionEmptyStyle}>—</div>
      </div>
    );
  }
  return (
    <div style={codeSectionStyle}>
      <div style={codeSectionLabelStyle}>{label}</div>
      <ul style={codeListStyle}>
        {codes.map((c, i) => (
          <li key={`${c.code}-${i}`} style={codeRowStyle}>
            <code style={codeBadgeStyle}>{c.code}</code>
            <PrivacyField
              value={c.reason_text}
              classificationId={classificationId}
              fieldPath={`denial_event:${eventId}.${kind}_codes[${i}].reason_text`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const listStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 8,
};

const eventCardStyle: React.CSSProperties = {
  padding: 12,
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 8,
  background: 'white',
};

const eventHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-secondary)',
  marginBottom: 10,
};

const dividerStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
};

const eventIdStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--tw-color-text-muted)',
  fontFamily: 'ui-monospace, monospace',
};

const codeSectionsStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
};

const codeSectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
};

const codeSectionLabelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--tw-color-text-muted)',
};

const codeSectionEmptyStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
};

const codeListStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 4,
};

const codeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: '0.8125rem',
  lineHeight: 1.4,
};

const codeBadgeStyle: React.CSSProperties = {
  background: 'var(--tw-color-border-muted, #E5E7EB)',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontFamily: 'ui-monospace, monospace',
  fontWeight: 500,
  flexShrink: 0,
};

const loadingStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
  padding: 12,
};

const errorStyle: React.CSSProperties = {
  padding: 10,
  background: 'var(--tw-color-status-warning-bg, #FFFBEB)',
  border: '1px solid var(--tw-color-status-warning-fg, #FCD34D)',
  borderRadius: 6,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-status-warning-fg, #D97706)',
};

const emptyStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
  padding: 10,
};
