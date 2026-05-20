/**
 * WorklistPage — the main analyst surface.
 *
 * DataExplorer handles search, density, column visibility, pagination and
 * bulk-selection chrome. Row-detail expansion is achieved by rendering
 * the selected row's <RowDetailPanel> beneath the grid in a slide-down
 * panel (DataExplorer does not have built-in row-expansion).
 *
 * URL state: filters + page index live in useWorklistFilters
 * (localStorage v4 key per user). Expanded row id is component-local
 * (deliberately — opening a row detail shouldn't survive page reload).
 */

import { useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { DataExplorer } from '@tensaw/composition/data-display';
import { useWorklistFilters, type WorklistFilters } from '../../hooks/useWorklistFilters';
import type { WorklistResponse, WorklistRow } from '../../actions/schemas';
import { WORKLIST_COLUMNS } from './columns';
import { DenialFilterStrip } from '../../components/DenialFilterStrip';
import { DenialBulkActionBar } from '../../components/DenialBulkActionBar';
import { RowDetailPanel } from '../../components/RowDetailPanel';

export function WorklistPage() {
  const { filters, setFilters, page, setPage } = useWorklistFilters();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useActionQuery<
    WorklistFilters,
    WorklistResponse
  >('denial.list', { ...filters, page });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 50;

  // Lookup table — needed by DenialBulkActionBar for D-19 gate, since
  // it operates on full WorklistRow objects, not just ids.
  const rowsById = useMemo(() => {
    const m = new Map<string, WorklistRow>();
    for (const r of rows) m.set(r.classification.classification_id, r);
    return m;
  }, [rows]);

  const selectedRows = useMemo(
    () =>
      selectedIds
        .map((id) => rowsById.get(id))
        .filter((r): r is WorklistRow => r !== undefined),
    [selectedIds, rowsById],
  );

  // Client-side search filter on top of server rows (search box is uncontrolled
  // server-side since the mock API doesn't support it; real impl passes to API).
  const visibleRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        String(r.claim.claim_id).includes(q) ||
        r.classification.primary_category.toLowerCase().includes(q) ||
        (r.claim.primary_payer_name ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const expandedRow = expandedId ? rowsById.get(expandedId) : null;

  const handleMutated = () => {
    refetch();
    setExpandedId(null);
    setSelectedIds([]);
  };

  // Toggle row expansion on row click (via actions slot + row selection click)
  function handleSelectionChange(ids: string[]) {
    setSelectedIds(ids);
    // If a single row was just selected and bulk bar not active, open detail
    if (ids.length === 1 && selectedIds.length !== 1) {
      setExpandedId(ids[0] ?? null);
    } else if (ids.length === 0) {
      setExpandedId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <DataExplorer<WorklistRow>
        rows={visibleRows}
        columns={WORKLIST_COLUMNS}
        totalRows={search.trim() ? visibleRows.length : total}
        getRowId={(r) => r.classification.classification_id}
        loading={isLoading}
        empty={{
          title: 'No claims match these filters',
          description: 'Try clearing a filter or changing the state.',
        }}
        // Search
        searchPlaceholder="Search by claim ID, category or payer…"
        searchValue={search}
        onSearchChange={setSearch}
        // Pagination
        pageIndex={page - 1}
        pageSize={pageSize}
        onPageChange={(next) => setPage(next + 1)}
        // Selection
        selectionMode="multi"
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        // Filters and bulk actions slots
        filters={
          <DenialFilterStrip
            filters={filters}
            onChange={setFilters}
          />
        }
        bulkActions={
          selectedRows.length > 0 ? (
            <DenialBulkActionBar
              selectedRows={selectedRows}
              onClear={() => setSelectedIds([])}
              onMutated={handleMutated}
            />
          ) : null
        }
      />

      {/* Row-detail panel — slides in beneath the grid when a single row is expanded */}
      {expandedRow && (
        <div
          className="rounded-md border border-border bg-background shadow-sm"
          role="region"
          aria-label="Row detail"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-medium text-foreground">
              Claim detail — {expandedRow.claim.claim_id}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={() => setExpandedId(null)}
              aria-label="Close detail panel"
            >
              ✕ Close
            </button>
          </div>
          <RowDetailPanel row={expandedRow} onMutated={handleMutated} />
        </div>
      )}
    </div>
  );
}
