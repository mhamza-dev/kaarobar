/** Shared staff listing filter state — ready for BE `q`/`from`/`to`/`status`/`category` params. */

export type StaffListFilterState = {
  search: string;
  from: string;
  to: string;
  statuses: string[];
  categories: string[];
};

export type ListFilterOption = {
  value: string;
  label: string;
};

export type ListFilterConfig = {
  showDateRange?: boolean;
  categoryOptions?: Array<string | ListFilterOption>;
  categoryLabel?: string;
  statusOptions?: ListFilterOption[];
  statusLabel?: string;
};

export type StaffListAccessors<T> = {
  searchText: (item: T) => string;
  /** ISO date or datetime; compared as YYYY-MM-DD against from/to. */
  date?: (item: T) => string | Date | null | undefined;
  status?: (item: T) => string | null | undefined;
  category?: (item: T) => string | null | undefined;
};

export function emptyStaffListFilters(): StaffListFilterState {
  return {
    search: "",
    from: "",
    to: "",
    statuses: [],
    categories: [],
  };
}

export function normalizeFilterOptions(
  options: Array<string | ListFilterOption> = []
): ListFilterOption[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
}

/** Advanced filters only (excludes search). */
export function countAdvancedFilters(
  state: StaffListFilterState,
  config: ListFilterConfig = {}
): number {
  let n = 0;
  if (config.showDateRange) {
    if (state.from.trim()) n += 1;
    if (state.to.trim()) n += 1;
  }
  if ((config.statusOptions?.length ?? 0) > 0 && state.statuses.length > 0) {
    n += 1;
  }
  if (
    (config.categoryOptions?.length ?? 0) > 0 &&
    state.categories.length > 0
  ) {
    n += 1;
  }
  return n;
}

export function staffListFiltersActive(
  state: StaffListFilterState,
  config: ListFilterConfig = {}
): boolean {
  return (
    state.search.trim() !== "" || countAdvancedFilters(state, config) > 0
  );
}

function toDayKey(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export function applyStaffListFilters<T>(
  items: T[],
  state: StaffListFilterState,
  accessors: StaffListAccessors<T>
): T[] {
  const q = state.search.trim().toLowerCase();
  const from = state.from.trim();
  const to = state.to.trim();
  const statuses = new Set(state.statuses.map((s) => s.toLowerCase()));
  const categories = new Set(state.categories.map((c) => c.toLowerCase()));

  return items.filter((item) => {
    if (q) {
      const hay = accessors.searchText(item).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if ((from || to) && accessors.date) {
      const day = toDayKey(accessors.date(item));
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    if (statuses.size > 0 && accessors.status) {
      const st = (accessors.status(item) || "").toLowerCase();
      if (!statuses.has(st)) return false;
    }
    if (categories.size > 0 && accessors.category) {
      const cat = (accessors.category(item) || "").toLowerCase();
      if (!categories.has(cat)) return false;
    }
    return true;
  });
}

/** Query-string shape for future / existing list APIs. */
export function staffListFilterParams(
  state: StaffListFilterState
): Record<string, string> {
  const params: Record<string, string> = {};
  if (state.search.trim()) params.q = state.search.trim();
  if (state.from.trim()) params.from = state.from.trim();
  if (state.to.trim()) params.to = state.to.trim();
  if (state.statuses.length === 1) params.status = state.statuses[0];
  else if (state.statuses.length > 1)
    params.status = state.statuses.join(",");
  if (state.categories.length === 1) params.category = state.categories[0];
  else if (state.categories.length > 1)
    params.category = state.categories.join(",");
  return params;
}

export function staffListFilterQuery(state: StaffListFilterState): string {
  const params = staffListFilterParams(state);
  const sp = new URLSearchParams(params);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
