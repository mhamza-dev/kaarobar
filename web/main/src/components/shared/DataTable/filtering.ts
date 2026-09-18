import type { DataTableFilter, DataTableFilterState, DataTableSearch } from "./types";

/**
 * Client-side search/filter over the rows already fetched.
 *
 * Extracted from the component so it can be tested directly, and kept
 * deliberately simple: with cursor pagination the table only ever holds the
 * pages loaded so far, so this narrows *what is on screen* — it is not a
 * search over the dataset. A screen whose dataset outgrows the client
 * pushes `search`/filters to the backend as real query params instead; see
 * the note on `DataTable`.
 */
export function filterRows<T>({
  rows,
  query,
  search,
  filterState,
  filters,
}: {
  rows: T[];
  query: string;
  search?: DataTableSearch<T>;
  filterState: DataTableFilterState;
  filters?: DataTableFilter<T>[];
}): T[] {
  const trimmed = query.trim().toLowerCase();

  return rows.filter((row) => {
    if (trimmed && search && !search.getText(row).toLowerCase().includes(trimmed)) {
      return false;
    }

    for (const filter of filters ?? []) {
      const selected = filterState[filter.id];
      // "" is the "Any" option — an absent filter, not a value to match.
      if (!selected) continue;

      const value = filter.getValue(row);
      const normalized = typeof value === "boolean" ? String(value) : (value ?? "");
      if (String(normalized) !== selected) return false;
    }

    return true;
  });
}

/** True when any filter is set to something other than "Any". */
export function hasActiveFilters(filterState: DataTableFilterState): boolean {
  return Object.values(filterState).some((value) => !!value);
}
