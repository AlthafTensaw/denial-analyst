/**
 * DenialBulkActionBar — selection-driven actions.
 *
 * PR-4 changes from PR-3:
 *   - Drops Bulk Override button (no backend endpoint).
 *   - Replaces server-side Export CSV with client-side CSV from
 *     selectedRowMap. Reuses PR-3.1's `finalizeCsvDownload` + watermark
 *     conventions but sources data in-memory rather than POSTing.
 *   - Accept all calls `denial.bulk-accept` with classification_ids
 *     (UUIDs). Response parsing switches to `requested / accepted /
 *     rejected` shape.
 *   - Partial-success toast pattern preserved per Q#11.
 *   - D-19 gate evaluator drops the category_mismatch check (server
 *     doesn't enforce single-shared-category).
 */

import { useState } from 'react';
import { useActionMutation } from '@tensaw/actions';
import { useAuthStore } from '@tensaw/runtime';
import type {
  BulkAcceptResponse,
  WorklistRow,
} from '../actions/schemas';
import { evaluateD19Gate } from './d19Gate';
import { friendlyErrorMessage } from '../lib/problem';

interface DenialBulkActionBarProps {
  selectedRowMap: ReadonlyMap<string, WorklistRow>;
  onClearSelection: () => void;
  onMutationComplete: () => void;
}

export function DenialBulkActionBar({
  selectedRowMap,
  onClearSelection,
  onMutationComplete,
}: DenialBulkActionBarProps): JSX.Element | null {
  const [toast, setToast] = useState<string | null>(null);
  const bulkAccept = useActionMutation('denial.bulk-accept');
  const user = useAuthStore((s) => s.user);

  if (selectedRowMap.size === 0) return null;
  const selectedRows = Array.from(selectedRowMap.values());
  const gate = evaluateD19Gate(selectedRows);

  const handleAcceptAll = async () => {
    if (!gate.ok) return;
    try {
      const res = (await bulkAccept.mutateAsync({
        classification_ids: selectedRows.map(
          (r) => r.classification.classification_id,
        ),
      })) as BulkAcceptResponse;

      if (res.rejected.length === 0) {
        setToast(`Accepted ${res.accepted.length} rows.`);
      } else {
        const reasonSummary = summarizeRejections(res);
        setToast(
          `Accepted ${res.accepted.length} / ${res.requested}. Rejected ${res.rejected.length}: ${reasonSummary}`,
        );
      }
      onClearSelection();
      onMutationComplete();
    } catch (err) {
      setToast(`Accept failed: ${friendlyErrorMessage(err)}`);
    }
  };

  const handleExportCsv = () => {
    const filename = csvFilename(user?.email ?? 'anonymous');
    const blob = buildCsvBlob(selectedRows, {
      user: user?.email ?? 'anonymous',
      generatedAt: new Date().toISOString(),
    });
    triggerDownload(blob, filename);
    setToast(`Exported ${selectedRows.length} rows as ${filename}.`);
  };

  return (
    <div style={barStyle}>
      <span style={countStyle}>{selectedRowMap.size} selected</span>
      <span style={dividerStyle}>|</span>
      <div style={actionsStyle}>
        <span title={gate.ok ? undefined : gate.reason}>
          <button
            type="button"
            disabled={!gate.ok || bulkAccept.isPending}
            onClick={() => void handleAcceptAll()}
            style={{
              ...primaryBtnStyle,
              background: gate.ok
                ? 'var(--tw-color-teal-600)'
                : 'var(--tw-color-gray-200)',
              color: gate.ok ? 'white' : 'var(--tw-color-gray-600)',
              cursor: gate.ok ? 'pointer' : 'not-allowed',
            }}
          >
            {bulkAccept.isPending ? 'Accepting…' : 'Accept all'}
          </button>
        </span>
        <button
          type="button"
          onClick={handleExportCsv}
          style={secondaryBtnStyle}
        >
          Export csv
        </button>
      </div>
      <button
        type="button"
        onClick={onClearSelection}
        style={clearSelectionStyle}
      >
        Clear selection
      </button>

      {toast && (
        <div role="status" style={toastStyle}>
          {toast}
          <button
            type="button"
            onClick={() => setToast(null)}
            style={toastCloseStyle}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV — client-side, watermark-stamped (PR-3.1 spec preserved)
// ---------------------------------------------------------------------------

interface CsvWatermark {
  user: string;
  generatedAt: string;
}

function buildCsvBlob(
  rows: readonly WorklistRow[],
  watermark: CsvWatermark,
): Blob {
  const header = [
    '# Tensaw Denial Tool — Worklist export',
    `# Generated: ${watermark.generatedAt}`,
    `# User: ${watermark.user}`,
    `# Row count: ${rows.length}`,
    '#',
  ].join('\n');

  const columns = [
    'classification_id',
    'claim_id',
    'state',
    'primary_category',
    'confidence',
    'classification_source',
    'priority_chips',
    'recommended_owner',
    'sla_next_action_date',
    'payer',
    'amount',
    'net_pending',
    'dos',
    'aging_bucket',
    'current_status_label',
  ];

  const csvRows = [
    columns.join(','),
    ...rows.map((r) =>
      [
        r.classification.classification_id,
        r.claim.claim_id,
        r.classification.state,
        csvEscape(r.classification.primary_category),
        r.classification.confidence,
        r.classification.classification_source,
        csvEscape(r.classification.priority_chips.join('|')),
        csvEscape(r.classification.recommended_owner),
        r.classification.sla_next_action_date,
        csvEscape(r.claim.primary_payer_name ?? ''),
        r.claim.amount,
        r.claim.net_pending,
        r.claim.dos,
        csvEscape(r.claim.aging_bucket ?? ''),
        csvEscape(r.claim.current_status_label ?? ''),
      ].join(','),
    ),
  ];

  const body = csvRows.join('\n');
  return new Blob([header + '\n' + body + '\n'], {
    type: 'text/csv;charset=utf-8',
  });
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function csvFilename(user: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  return `denial-worklist-${user.replace(/[^a-z0-9.-]/gi, '_')}-${stamp}.csv`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation to give the browser a tick to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizeRejections(res: BulkAcceptResponse): string {
  const counts = new Map<string, number>();
  for (const r of res.rejected) {
    counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([k, n]) => `${n} ${k.toLowerCase()}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const barStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '10px 16px',
  background: 'var(--tw-color-teal-50)',
  border: '1px solid var(--tw-color-teal-200)',
  borderRadius: 8,
  color: 'var(--tw-color-teal-800)',
  fontSize: '0.8125rem',
};

const countStyle: React.CSSProperties = {
  fontWeight: 500,
};

const dividerStyle: React.CSSProperties = {
  color: 'var(--tw-color-teal-200)',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  border: 'none',
  borderRadius: 4,
  fontSize: '0.8125rem',
  fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'transparent',
  color: 'var(--tw-color-teal-700)',
  border: '1px solid var(--tw-color-teal-700)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const clearSelectionStyle: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'transparent',
  border: 'none',
  color: 'var(--tw-color-teal-700)',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '0.8125rem',
};

const toastStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  background: 'var(--tw-color-gray-800)',
  color: 'white',
  padding: '8px 36px 8px 12px',
  borderRadius: 6,
  fontSize: '0.8125rem',
  zIndex: 30,
  maxWidth: 480,
};

const toastCloseStyle: React.CSSProperties = {
  position: 'absolute',
  right: 6,
  top: 4,
  background: 'transparent',
  border: 'none',
  color: 'white',
  fontSize: '1.2rem',
  lineHeight: 1,
  cursor: 'pointer',
};
