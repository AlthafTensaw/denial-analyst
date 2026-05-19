/**
 * RecommendationGrid — worklist data grid with row selection + expansion.
 *
 * PR-4 changes from PR-2/PR-3:
 *   - `getRowId` returns the classification_id UUID string (was an int).
 *   - Selected ids are tracked as `Map<string, WorklistRow>` so the
 *     parent can drive bulk actions + client-side CSV from the actual
 *     selected rows.
 *   - No column-header sort UI. Backend imposes the order; the FE just
 *     renders.
 *   - Row expansion is unchanged in shape; the expanded panel is
 *     supplied by the parent via `renderExpansion`.
 *
 * Built as a custom grid (not wrapping DataExplorerWired) because
 * `@tensaw/composition/data-display` doesn't yet expose a row-expansion
 * hook. Filed as platform handback in README.
 */

import { useMemo } from 'react';
import type { WorklistRow } from '../actions/schemas';
import { WORKLIST_COLUMNS } from '../pages/worklist/columns';

interface RecommendationGridProps {
  rows: readonly WorklistRow[];
  /** Selected classification_ids (UUID strings). */
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (
    next: ReadonlyMap<string, WorklistRow>,
  ) => void;
  /** classification_id of the currently expanded row, if any. */
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  renderExpansion: (row: WorklistRow) => JSX.Element;
  /** Loading indicator surface (replaces the body). */
  loading?: boolean;
  /** Empty-state JSX (rendered when rows.length === 0 and not loading). */
  emptyState?: JSX.Element;
}

export function RecommendationGrid({
  rows,
  selectedIds,
  onSelectionChange,
  expandedId,
  onToggleExpand,
  renderExpansion,
  loading,
  emptyState,
}: RecommendationGridProps): JSX.Element {
  const gridTemplate = useMemo(
    () =>
      `36px ${WORKLIST_COLUMNS.map((c) => c.width).join(' ')}`,
    [],
  );

  const rowsById = useMemo(() => {
    const m = new Map<string, WorklistRow>();
    for (const r of rows) m.set(r.classification.classification_id, r);
    return m;
  }, [rows]);

  const allSelectable = rows.filter(
    (r) => r.classification.state === 'recommended',
  );
  const allSelected =
    allSelectable.length > 0 &&
    allSelectable.every((r) =>
      selectedIds.has(r.classification.classification_id),
    );

  const toggleRow = (row: WorklistRow) => {
    const id = row.classification.classification_id;
    const next = new Map<string, WorklistRow>();
    for (const sid of selectedIds) {
      const existing = rowsById.get(sid);
      if (existing) next.set(sid, existing);
    }
    if (next.has(id)) next.delete(id);
    else next.set(id, row);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Map());
    } else {
      const next = new Map<string, WorklistRow>();
      for (const r of allSelectable)
        next.set(r.classification.classification_id, r);
      onSelectionChange(next);
    }
  };

  return (
    <div style={gridContainerStyle}>
      {/* Header row */}
      <div
        role="row"
        style={{
          ...headerRowStyle,
          gridTemplateColumns: gridTemplate,
        }}
      >
        <div role="columnheader" style={selectCellStyle}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all eligible rows"
          />
        </div>
        {WORKLIST_COLUMNS.map((c) => (
          <div
            key={c.id}
            role="columnheader"
            style={{
              ...headerCellStyle,
              textAlign: c.align ?? 'left',
              justifyContent:
                c.align === 'right' ? 'flex-end' : 'flex-start',
            }}
          >
            {c.header}
          </div>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div style={loadingStyle}>Loading…</div>
      ) : rows.length === 0 ? (
        (emptyState ?? <div style={loadingStyle}>No matching rows</div>)
      ) : (
        rows.map((row) => {
          const id = row.classification.classification_id;
          const selected = selectedIds.has(id);
          const expanded = expandedId === id;
          const eligible = row.classification.state === 'recommended';
          return (
            <div key={id}>
              <div
                role="row"
                data-row-id={id}
                onClick={() => { onToggleExpand(expanded ? null : id); }}
                style={{
                  ...rowStyle,
                  gridTemplateColumns: gridTemplate,
                  background: selected
                    ? 'var(--tw-color-table-header-bg, #EBF7F6)'
                    : expanded
                      ? 'var(--tw-color-surface-muted, #F9FAFB)'
                      : undefined,
                }}
              >
                <div
                  style={selectCellStyle}
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => { toggleRow(row); }}
                    aria-label={`Select row ${row.claim.claim_id}`}
                    disabled={!eligible}
                  />
                </div>
                {WORKLIST_COLUMNS.map((c) => (
                  <div
                    key={c.id}
                    role="cell"
                    style={{
                      ...cellStyle,
                      textAlign: c.align ?? 'left',
                      justifyContent:
                        c.align === 'right' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {c.render(row)}
                  </div>
                ))}
              </div>
              {expanded && (
                <div data-row-detail-for={id} style={expansionStyle}>
                  {renderExpansion(row)}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const gridContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'white',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 12,
  overflow: 'hidden',
};

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  alignItems: 'center',
  background: 'var(--tw-color-table-header-bg, #EBF7F6)',
  color: 'var(--tw-color-brand-header, #149A9A)',
  fontSize: '0.8125rem',
  fontWeight: 500,
  borderBottom: '1px solid var(--tw-color-border-default)',
};

const headerCellStyle: React.CSSProperties = {
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
};

const selectCellStyle: React.CSSProperties = {
  padding: '12px 6px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  alignItems: 'center',
  borderBottom: '1px solid var(--tw-color-border-default)',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const cellStyle: React.CSSProperties = {
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'center',
};

const expansionStyle: React.CSSProperties = {
  background: 'var(--tw-color-surface-muted, #F9FAFB)',
  borderBottom: '1px solid var(--tw-color-border-default)',
  padding: '16px 20px',
};

const loadingStyle: React.CSSProperties = {
  padding: '40px',
  textAlign: 'center',
  color: 'var(--tw-color-text-muted)',
};
