/**
 * DenialFilterStrip — single-value filter chips.
 *
 * PR-4 changes from PR-3:
 *   - Single-select (not multi). Backend accepts one value per filter
 *     dimension per the route signature.
 *   - Filter keys match backend's WorklistRequest exactly: state /
 *     primary_category / recommended_owner / payer_name / age_bucket /
 *     priority_chip / requires_human_review / classification_source.
 *   - Confidence filter dropped (backend doesn't accept it).
 *   - Max-amount filter dropped (backend has min_amount_cents only).
 *   - Category list is the static 34-value CATEGORY_VALUES — no facets
 *     fetch (endpoint doesn't exist).
 *   - Payer + owner lists are seeded from WORKLIST_FIXTURE_META in dev;
 *     in production they'd come from a separate static-versioned source.
 */

import { useState } from 'react';
import { WORKLIST_FIXTURE_META } from '@tensaw/mock-server';
import {
  CATEGORY_VALUES,
  ClassificationSourceEnum,
  ClassificationStateEnum,
  PriorityChipEnum,
} from '../actions/schemas';
import type {
  UseWorklistFiltersResult,
  WorklistFilters,
} from '../hooks/useWorklistFilters';

interface DenialFilterStripProps {
  filtersApi: UseWorklistFiltersResult;
}

const STATE_OPTIONS = ClassificationStateEnum.options;
const PRIORITY_OPTIONS = PriorityChipEnum.options;
const SOURCE_OPTIONS = ClassificationSourceEnum.options;
const AGE_BUCKET_OPTIONS = [
  '0-29 day',
  '30-59 day',
  '60-89 day',
  '90-119 day',
  '120-179 day',
  '180+ day',
];

export function DenialFilterStrip({
  filtersApi,
}: DenialFilterStripProps): JSX.Element {
  const { filters, setFilter, clearAll, activeCount } = filtersApi;

  return (
    <div style={stripStyle} >
      <span style={labelStyle}>
        Filters
        {activeCount > 0 && <span style={countPillStyle}>{activeCount}</span>}
      </span>

      <FilterDropdown
        label="State"
        value={filters.state}
        options={STATE_OPTIONS}
        onChange={(v) =>
          setFilter('state', v as WorklistFilters['state'])
        }
      />
      <FilterDropdown
        label="Category"
        value={filters.primary_category}
        options={CATEGORY_VALUES}
        onChange={(v) => setFilter('primary_category', v)}
      />
      <FilterDropdown
        label="Priority"
        value={filters.priority_chip}
        options={PRIORITY_OPTIONS}
        onChange={(v) =>
          setFilter('priority_chip', v as WorklistFilters['priority_chip'])
        }
      />
      <FilterDropdown
        label="Payer"
        value={filters.payer_name}
        options={WORKLIST_FIXTURE_META.payers}
        onChange={(v) => setFilter('payer_name', v)}
      />
      <FilterDropdown
        label="Owner"
        value={filters.recommended_owner}
        options={WORKLIST_FIXTURE_META.recommended_owners}
        onChange={(v) => setFilter('recommended_owner', v)}
      />
      <FilterDropdown
        label="Aging"
        value={filters.age_bucket}
        options={AGE_BUCKET_OPTIONS}
        onChange={(v) => setFilter('age_bucket', v)}
      />
      <FilterDropdown
        label="Source"
        value={filters.classification_source}
        options={SOURCE_OPTIONS}
        onChange={(v) =>
          setFilter(
            'classification_source',
            v as WorklistFilters['classification_source'],
          )
        }
      />
      <BooleanToggle
        label="Needs review"
        value={filters.requires_human_review}
        onChange={(v) => setFilter('requires_human_review', v)}
      />

      {activeCount > 0 && (
        <button type="button" onClick={clearAll} style={clearBtnStyle}>
          Clear all
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FilterDropdownProps {
  label: string;
  value: string | undefined;
  options: readonly string[];
  onChange: (v: string | undefined) => void;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: FilterDropdownProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const active = value !== undefined;
  const displayValue = active ? value : 'Any';

  const handleSelect = (v: string | undefined) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <span style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        style={{
          ...chipBaseStyle,
          background: active
            ? 'var(--tw-color-teal-50)'
            : 'var(--tw-color-gray-50)',
          color: active
            ? 'var(--tw-color-teal-800)'
            : 'var(--tw-color-text-secondary)',
          borderColor: active
            ? 'var(--tw-color-teal-200)'
            : 'var(--tw-color-border)',
        }}
      >
        <span style={chipLabelStyle}>{label}:</span>
        <span>{displayValue}</span>
        <span style={caretStyle}>▾</span>
      </button>
      {open && (
        <div style={dropdownStyle}>
          <div
            style={dropdownItemStyle}
            onClick={() => handleSelect(undefined)}
          >
            Any
          </div>
          {options.map((opt) => (
            <div
              key={opt}
              style={{
                ...dropdownItemStyle,
                background:
                  opt === value
                    ? 'var(--tw-color-teal-50)'
                    : undefined,
              }}
              onClick={() => handleSelect(opt)}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

interface BooleanToggleProps {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}

function BooleanToggle({
  label,
  value,
  onChange,
}: BooleanToggleProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(value === true ? undefined : true)}
      style={{
        ...chipBaseStyle,
        background:
          value === true
            ? 'var(--tw-color-teal-50)'
            : 'var(--tw-color-gray-50)',
        color:
          value === true
            ? 'var(--tw-color-teal-800)'
            : 'var(--tw-color-text-secondary)',
        borderColor:
          value === true
            ? 'var(--tw-color-teal-200)'
            : 'var(--tw-color-border)',
      }}
    >
      {value === true ? '✓ ' : ''}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const stripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  background: 'white',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 8,
  flexWrap: 'wrap',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 500,
  color: 'var(--tw-color-text-secondary)',
  fontSize: '0.8125rem',
};

const countPillStyle: React.CSSProperties = {
  background: 'var(--tw-color-teal-600)',
  color: 'white',
  fontSize: '0.6875rem',
  padding: '1px 7px',
  borderRadius: '9999px',
  fontWeight: 500,
  minWidth: 18,
  textAlign: 'center',
};

const chipBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  border: '1px solid',
  borderRadius: 6,
  fontSize: '0.8125rem',
  cursor: 'pointer',
  background: 'transparent',
  color: 'inherit',
};

const chipLabelStyle: React.CSSProperties = {
  fontWeight: 500,
};

const caretStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
  fontSize: '0.7rem',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  background: 'white',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 6,
  padding: 4,
  maxHeight: 320,
  overflowY: 'auto',
  minWidth: 240,
  zIndex: 50,
  boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

const clearBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'transparent',
  border: 'none',
  color: 'var(--tw-color-text-secondary)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  textDecoration: 'underline',
};
