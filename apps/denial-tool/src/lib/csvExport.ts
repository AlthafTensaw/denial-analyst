import type { WorklistRow } from '../actions/schemas';

interface ExportOptions {
  user?: string;
}

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsv(rows: WorklistRow[]): string {
  const header = [
    'claim_id',
    'classification_id',
    'state',
    'confidence',
    'priority',
    'payer_name',
    'recommended_owner',
    'primary_category',
    'current_status',
    'amount_cents',
  ];

  const lines = rows.map((row) =>
    [
      row.claim.claim_id,
      row.classification.classification_id,
      row.classification.state,
      row.classification.confidence,
      row.classification.priority_chip,
      row.claim.payer_name,
      row.classification.recommended_owner,
      row.classification.primary_category,
      row.claim.current_status_label,
      row.claim.billed_amount_cents,
    ]
      .map(escapeCsv)
      .join(','),
  );

  return [header.map(escapeCsv).join(','), ...lines].join('\n');
}

export function exportSelectedRowsToCSV(
  rows: WorklistRow[],
  _options?: ExportOptions,
): void {
  if (rows.length === 0) return;

  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `denial-selected-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
