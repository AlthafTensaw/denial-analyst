/**
 * WorklistPage — the denial-tool worklist screen.
 *
 * PR-4 changes from PR-3:
 *
 *   1. No latest-run header strip or 36h stale banner — `/v1/runs/latest`
 *      doesn't exist. The page header is just the title + selection pill.
 *
 *   2. Selection state is `Map<string, WorklistRow>` (was: `Map<number, ...>`)
 *      so the bulk-action bar can drive client-side CSV from the in-memory
 *      selected rows.
 *
 *   3. Request shape uses backend's WorklistRequest fields directly —
 *      single-valued filters, snake_case keys, no sort_by/sort_dir.
 *
 *   4. Refetch after every mutation since the StateTransitionResponse
 *      doesn't contain the updated row. The cache invalidation in the
 *      actions registry handles this automatically when the cache tags
 *      line up; we also call refetch() explicitly as a belt-and-braces.
 */

import { useCallback, useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { DenialBulkActionBar } from '../../components/DenialBulkActionBar';
import { DenialFilterStrip } from '../../components/DenialFilterStrip';
import { RecommendationGrid } from '../../components/RecommendationGrid';
import { RowDetailPanel } from '../../components/RowDetailPanel';
import { useWorklistFilters } from '../../hooks/useWorklistFilters';
import type {
  WorklistRequest,
  WorklistResponse,
  WorklistRow,
} from '../../actions/schemas';

const PAGE_SIZE = 50;

export function WorklistPage(): JSX.Element {
  const filtersApi = useWorklistFilters();
  const { filters } = filtersApi;

  const [page, setPage] = useState(1);
  const [selectedRowMap, setSelectedRowMap] = useState<
    ReadonlyMap<string, WorklistRow>
  >(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Translate FE filters → backend WorklistRequest. Strip undefined values.
  const request = useMemo<WorklistRequest>(() => {
    const out: WorklistRequest = {
      page,
      page_size: PAGE_SIZE,
    };
    if (filters.state) out.state = filters.state;
    if (filters.primary_category)
      out.primary_category = filters.primary_category;
    if (filters.recommended_owner)
      out.recommended_owner = filters.recommended_owner;
    if (filters.payer_name) out.payer_name = filters.payer_name;
    if (filters.age_bucket) out.age_bucket = filters.age_bucket;
    if (filters.priority_chip) out.priority_chip = filters.priority_chip;
    if (filters.classification_source)
      out.classification_source = filters.classification_source;
    if (filters.requires_human_review !== undefined)
      out.requires_human_review = filters.requires_human_review;
    if (filters.min_amount_cents !== undefined)
      out.min_amount_cents = filters.min_amount_cents;
    return out;
  }, [filters, page]);

  const query = useActionQuery<WorklistResponse>('denial.list', request);
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSelectionChange = useCallback(
    (next: ReadonlyMap<string, WorklistRow>) => {
      setSelectedRowMap(next);
    },
    [],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedRowMap(new Map());
  }, []);

  const handleMutationComplete = useCallback(() => {
    void query.refetch();
  }, [query]);

  return (
    <div style={pageStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Denial Analysis Worklist</h1>
          {total > 0 && (
            <div style={subtitleStyle}>
              {total} recommendation{total === 1 ? '' : 's'}
              {filtersApi.activeCount > 0 && (
                <>
                  {' '}
                  · {filtersApi.activeCount} filter
                  {filtersApi.activeCount === 1 ? '' : 's'} active
                </>
              )}
            </div>
          )}
        </div>
        {selectedRowMap.size > 0 && (
          <span style={selectionPillStyle}>
            {selectedRowMap.size} selected
          </span>
        )}
      </header>

      <DenialFilterStrip filtersApi={filtersApi} />

      {selectedRowMap.size > 0 && (
        <DenialBulkActionBar
          selectedRowMap={selectedRowMap}
          onClearSelection={handleClearSelection}
          onMutationComplete={handleMutationComplete}
        />
      )}

      <RecommendationGrid
        rows={rows}
        selectedIds={
          new Set(Array.from(selectedRowMap.keys()))
        }
        onSelectionChange={handleSelectionChange}
        expandedId={expandedId}
        onToggleExpand={setExpandedId}
        renderExpansion={(row) => (
          <RowDetailPanel
            row={row}
            onMutationComplete={handleMutationComplete}
          />
        )}
        loading={query.isLoading}
        emptyState={
          <div style={emptyStateStyle}>
            <p>No rows match your filters.</p>
            {filtersApi.activeCount > 0 && (
              <button
                type="button"
                onClick={filtersApi.clearAll}
                style={clearBtnStyle}
              >
                Clear all filters
              </button>
            )}
          </div>
        }
      />

      {total > PAGE_SIZE && (
        <div style={paginationStyle}>
          <div style={paginationInfoStyle}>
            Page {page} of {totalPages} · {total} rows
          </div>
          <div style={paginationControlsStyle}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={pageBtnStyle}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!query.data?.has_more}
              onClick={() => setPage((p) => p + 1)}
              style={pageBtnStyle}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {query.isError && (
        <div role="alert" style={errorBannerStyle}>
          Failed to load worklist. {query.error?.message ?? ''}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 1440,
  margin: '0 auto',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 500,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
};

const selectionPillStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--tw-color-teal-700)',
  padding: '4px 12px',
  background: 'var(--tw-color-teal-50)',
  borderRadius: 6,
  fontWeight: 500,
};

const emptyStateStyle: React.CSSProperties = {
  padding: 60,
  textAlign: 'center',
  color: 'var(--tw-color-text-muted)',
};

const clearBtnStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '6px 16px',
  background: 'var(--tw-color-teal-600)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
};

const paginationInfoStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
  fontSize: '0.8125rem',
};

const paginationControlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const pageBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 4,
  background: 'white',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

const errorBannerStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--tw-color-red-50)',
  border: '1px solid var(--tw-color-red-100, var(--tw-color-red-50))',
  borderRadius: 6,
  color: 'var(--tw-color-red-800)',
  fontSize: '0.8125rem',
};
