/**
 * DenialFilterStrip — denial-tool filter row.
 *
 * Composes <FilterStrip> from @tensaw/worklist with denial-specific filter
 * selects. Uses <Select> from @tensaw/design-system/forms with the correct
 * API: onValueChange (not onChange), size="sm" (not compact), aria-label.
 */

import { Select } from '@tensaw/design-system/forms';
import { Pill } from '@tensaw/design-system/feedback';
import type { ReactNode } from 'react';
import {
  CATEGORY_VALUES,
  PriorityChipEnum,
  ClassificationStateEnum,
  type PriorityChip,
  type ClassificationState,
} from '../actions/schemas';
import { type WorklistFilters } from '../hooks/useWorklistFilters';
import { WORKLIST_FIXTURE_META } from '@tensaw/mock-server';

interface DenialFilterStripProps {
  filters: WorklistFilters;
  onChange: (next: WorklistFilters) => void;
}

const ANY = '__ANY__';

const STATE_OPTIONS = ClassificationStateEnum.options.map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

const CATEGORY_OPTIONS = [{ value: ANY, label: 'Any category' }, ...CATEGORY_VALUES.map((v) => ({ value: v, label: v }))];

const PRIORITY_OPTIONS = [
  { value: ANY, label: 'Any priority' },
  ...PriorityChipEnum.options.map((v) => ({ value: v, label: v })),
];

const AGING_OPTIONS = [
  { value: ANY, label: 'Any aging' },
  { value: '0-29 day', label: '0–29 days' },
  { value: '30-59 day', label: '30–59 days' },
  { value: '60-89 day', label: '60–89 days' },
  { value: '90-119 day', label: '90–119 days' },
  { value: '120-179 day', label: '120–179 days' },
  { value: '180+ day', label: '180+ days' },
];

const PAYER_OPTIONS = [
  { value: ANY, label: 'Any payer' },
  ...WORKLIST_FIXTURE_META.payers.map((p) => ({ value: p, label: p })),
];

const OWNER_OPTIONS = [
  { value: ANY, label: 'Any owner' },
  ...WORKLIST_FIXTURE_META.recommended_owners.map((o) => ({ value: o, label: o })),
];

export function DenialFilterStrip({ filters, onChange }: DenialFilterStripProps) {
  const update = (patch: Partial<WorklistFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <div style={stripStyle}>
      <FilterCell label="State">
        <Select
          value={filters.state ?? 'recommended'}
          onValueChange={(v) => update({ state: v as ClassificationState })}
          options={STATE_OPTIONS}
          size="sm"
          aria-label="State"
        />
      </FilterCell>

      <FilterCell label="Category">
        <Select
          value={filters.primary_category ?? ANY}
          onValueChange={(v) =>
            update({ primary_category: v === ANY ? undefined : v })
          }
          options={CATEGORY_OPTIONS}
          size="sm"
          aria-label="Category"
        />
      </FilterCell>

      <FilterCell label="Payer">
        <Select
          value={filters.payer_name ?? ANY}
          onValueChange={(v) =>
            update({ payer_name: v === ANY ? undefined : v })
          }
          options={PAYER_OPTIONS}
          size="sm"
          aria-label="Payer"
        />
      </FilterCell>

      <FilterCell label="Owner">
        <Select
          value={filters.recommended_owner ?? ANY}
          onValueChange={(v) =>
            update({ recommended_owner: v === ANY ? undefined : v })
          }
          options={OWNER_OPTIONS}
          size="sm"
          aria-label="Owner"
        />
      </FilterCell>

      <FilterCell label="Aging">
        <Select
          value={filters.age_bucket ?? ANY}
          onValueChange={(v) =>
            update({ age_bucket: v === ANY ? undefined : v })
          }
          options={AGING_OPTIONS}
          size="sm"
          aria-label="Aging"
        />
      </FilterCell>

      <FilterCell label="Priority">
        <Select
          value={filters.priority_chip ?? ANY}
          onValueChange={(v) =>
            update({
              priority_chip: v === ANY ? undefined : (v as PriorityChip),
            })
          }
          options={PRIORITY_OPTIONS}
          size="sm"
          aria-label="Priority"
        />
      </FilterCell>

      <div style={reviewStyle}>
        {filters.requires_human_review ? (
          <Pill
            variant="subtle"
            tone="amber"
            removable
            onRemove={() => update({ requires_human_review: undefined })}
          >
            Review only
          </Pill>
        ) : (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
            onClick={() => update({ requires_human_review: true })}
          >
            + Review only
          </button>
        )}
      </div>
    </div>
  );
}

function FilterCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={cellStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={controlStyle}>{children}</div>
    </div>
  );
}

const stripStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'end',
  gap: 8,
  padding: 10,
  border: '1px solid var(--tw-color-border-default, var(--tw-color-border))',
  borderRadius: 8,
  background: 'var(--tw-color-surface-raised, #fff)',
};

const cellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 170,
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--tw-color-text-secondary)',
  fontWeight: 500,
};

const controlStyle: React.CSSProperties = {
  minWidth: 0,
};

const reviewStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginLeft: 'auto',
};
