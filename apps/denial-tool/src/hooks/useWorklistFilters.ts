/**
 * useWorklistFilters — single-value filter state, localStorage-backed.
 *
 * PR-4 rewrite: backend's WorklistRequest accepts a single value per
 * filter dimension (not an array). The hook's shape mirrors that.
 *
 * Persistence key: `tensaw:denial-tool:filters-v4:<userId>` — the `-v4`
 * suffix prevents PR-2/PR-3 stored state (multi-value) from
 * cross-contaminating after upgrade.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@tensaw/runtime';
import type {
  ClassificationSource,
  ClassificationState,
  PriorityChip,
} from '../actions/schemas';

export interface WorklistFilters {
  state: ClassificationState | undefined;
  primary_category: string | undefined;
  recommended_owner: string | undefined;
  payer_name: string | undefined;
  age_bucket: string | undefined;
  requires_human_review: boolean | undefined;
  priority_chip: PriorityChip | undefined;
  classification_source: ClassificationSource | undefined;
  min_amount_cents: number | undefined;
}

export const DEFAULT_FILTERS: WorklistFilters = {
  state: 'recommended',
  primary_category: undefined,
  recommended_owner: undefined,
  payer_name: undefined,
  age_bucket: undefined,
  requires_human_review: undefined,
  priority_chip: undefined,
  classification_source: undefined,
  min_amount_cents: undefined,
};

const STORAGE_KEY_PREFIX = 'tensaw:denial-tool:filters-v4:';

function storageKeyFor(userId: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}${userId ?? 'anonymous'}`;
}

function loadFilters(userId: string | undefined): WorklistFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(storageKeyFor(userId));
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { ...DEFAULT_FILTERS, ...parsed };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(
  userId: string | undefined,
  filters: WorklistFilters,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKeyFor(userId),
      JSON.stringify(filters),
    );
  } catch {
    // Quota / disabled storage — degrade silently.
  }
}

export interface UseWorklistFiltersResult {
  filters: WorklistFilters;
  setFilter: <K extends keyof WorklistFilters>(
    key: K,
    value: WorklistFilters[K],
  ) => void;
  clearAll: () => void;
  activeCount: number;
}

export function useWorklistFilters(): UseWorklistFiltersResult {
  const userId = useAuthStore((s) => s.user?.userId);
  const [filters, setFilters] = useState<WorklistFilters>(() =>
    loadFilters(userId),
  );

  useEffect(() => {
    setFilters(loadFilters(userId));
  }, [userId]);

  const setFilter = useCallback(
    <K extends keyof WorklistFilters>(
      key: K,
      value: WorklistFilters[K],
    ) => {
      setFilters((prev) => {
        const next: WorklistFilters = { ...prev, [key]: value };
        saveFilters(userId, next);
        return next;
      });
    },
    [userId],
  );

  const clearAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    saveFilters(userId, DEFAULT_FILTERS);
  }, [userId]);

  const activeCount = countActiveFilters(filters);

  return { filters, setFilter, clearAll, activeCount };
}

function countActiveFilters(filters: WorklistFilters): number {
  let count = 0;
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof WorklistFilters)[]) {
    if (filters[key] !== DEFAULT_FILTERS[key]) count += 1;
  }
  return count;
}
