/**
 * DenialEventsList — source-evidence region.
 *
 * Renders the array of denial events from
 * GET /v1/claims/{claim_id}/denial-events. Each event has 0..N CARC
 * codes and 0..N RARC codes; the `reason_text` for every code is PHI
 * and goes through PrivacyField.
 *
 * PR-6: platform Pill for code badges, wrapper PrivacyField (which
 * dispatches the reveal-phi audit through useActionMutation), Tailwind
 * utility classes.
 */

import { Pill } from '@tensaw/design-system/feedback';
import { Spinner } from '@tensaw/design-system/feedback';
import { Alert } from '@tensaw/design-system/feedback';
import type { DenialEvent, DenialEventCode } from '../actions/schemas';
import { PrivacyField } from './PrivacyField';

interface DenialEventsListProps {
  events: DenialEvent[] | undefined;
  loading?: boolean;
  classificationId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'unknown date';
  // ISO date or datetime → YYYY-MM-DD
  return iso.slice(0, 10);
}

function CodeRow({
  code,
  kind,
  eventId,
  classificationId,
}: {
  code: DenialEventCode;
  kind: 'carc' | 'rarc';
  eventId: number;
  classificationId: string;
}) {
  const variant = kind === 'carc' ? 'danger' : 'warning';
  return (
    <div className="flex items-center gap-2 text-xs">
      <Pill tone={variant as 'danger' | 'warning'} variant="subtle">
        <code className="font-mono">{code.code}</code>
      </Pill>
      <PrivacyField
        value={code.reason_text}
        classificationId={classificationId}
        fieldPath={`denial_event:${eventId}.${kind}.${code.code}.reason_text`}
        purpose="worklist_review"
      />
    </div>
  );
}

export function DenialEventsList({
  events,
  loading,
  classificationId,
}: DenialEventsListProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-secondary">
        <Spinner size="sm" /> Loading denial events…
      </div>
    );
  }
  if (!events) {
    return (
      <Alert variant="warning" tone="subtle">
        Could not load denial events.
      </Alert>
    );
  }

  const visible = events
    .filter((e) => !e.is_deleted)
    .sort((a, b) =>
      (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''),
    );

  if (visible.length === 0) {
    return (
      <Alert variant="info" tone="subtle">
        No denial events on file for this claim.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wide text-secondary font-medium">
        Source evidence · {visible.length}{' '}
        {visible.length === 1 ? 'event' : 'events'}
      </div>
      {visible.map((event) => (
        <div
          key={event.event_id}
          className="bg-secondary rounded-md p-2.5 flex flex-col gap-1.5"
        >
          <div className="text-xs text-secondary">
            {formatDate(event.occurred_at)} · CPT{' '}
            <code className="font-mono">{event.procedure_code ?? '—'}</code> ·
            event #{event.event_id}
          </div>
          {event.carc_codes.map((c, i) => (
            <CodeRow
              key={`carc-${event.event_id}-${c.code}-${i}`}
              code={c}
              kind="carc"
              eventId={event.event_id}
              classificationId={classificationId}
            />
          ))}
          {event.rarc_codes.map((c, i) => (
            <CodeRow
              key={`rarc-${event.event_id}-${c.code}-${i}`}
              code={c}
              kind="rarc"
              eventId={event.event_id}
              classificationId={classificationId}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
