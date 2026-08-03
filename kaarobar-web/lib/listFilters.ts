/** Shared staff listing filter state — BE `q`/`from`/`to`/ranges/`status`/`category`. */

export type StaffListFilterState = {
  search: string;
  from: string;
  to: string;
  statuses: string[];
  categories: string[];
  amountMin: string;
  amountMax: string;
  balanceMin: string;
  balanceMax: string;
  creditLimitMin: string;
  creditLimitMax: string;
  paymentMethods: string[];
};

export type ListFilterOption = {
  value: string;
  label: string;
};

export type ListFilterConfig = {
  showDateRange?: boolean;
  showAmountRange?: boolean;
  showBalanceRange?: boolean;
  showCreditLimitRange?: boolean;
  categoryOptions?: Array<string | ListFilterOption>;
  categoryLabel?: string;
  statusOptions?: ListFilterOption[];
  statusLabel?: string;
  paymentMethodOptions?: ListFilterOption[];
};

export type StaffListAccessors<T> = {
  searchText: (item: T) => string;
  /** ISO date or datetime; compared as YYYY-MM-DD against from/to. */
  date?: (item: T) => string | Date | null | undefined;
  status?: (item: T) => string | null | undefined;
  category?: (item: T) => string | null | undefined;
  amount?: (item: T) => number | string | null | undefined;
  balance?: (item: T) => number | string | null | undefined;
  creditLimit?: (item: T) => number | string | null | undefined;
  paymentMethod?: (item: T) => string | null | undefined;
};

export function emptyStaffListFilters(): StaffListFilterState {
  return {
    search: "",
    from: "",
    to: "",
    statuses: [],
    categories: [],
    amountMin: "",
    amountMax: "",
    balanceMin: "",
    balanceMax: "",
    creditLimitMin: "",
    creditLimitMax: "",
    paymentMethods: [],
  };
}

export function normalizeFilterOptions(
  options: Array<string | ListFilterOption> = []
): ListFilterOption[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
}

function rangeActive(min: string, max: string): number {
  let n = 0;
  if (min.trim()) n += 1;
  if (max.trim()) n += 1;
  return n;
}

/** Advanced filters only (excludes search). */
export function countAdvancedFilters(
  state: StaffListFilterState,
  config: ListFilterConfig = {}
): number {
  let n = 0;
  if (config.showDateRange) {
    n += rangeActive(state.from, state.to);
  }
  if (config.showAmountRange) {
    n += rangeActive(state.amountMin, state.amountMax);
  }
  if (config.showBalanceRange) {
    n += rangeActive(state.balanceMin, state.balanceMax);
  }
  if (config.showCreditLimitRange) {
    n += rangeActive(state.creditLimitMin, state.creditLimitMax);
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
  if (
    (config.paymentMethodOptions?.length ?? 0) > 0 &&
    state.paymentMethods.length > 0
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

function toNum(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function inRange(
  value: number | null,
  minStr: string,
  maxStr: string
): boolean {
  if (value == null) return !(minStr.trim() || maxStr.trim());
  const min = minStr.trim() ? Number(minStr) : null;
  const max = maxStr.trim() ? Number(maxStr) : null;
  if (min != null && Number.isFinite(min) && value < min) return false;
  if (max != null && Number.isFinite(max) && value > max) return false;
  return true;
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
  const methods = new Set(state.paymentMethods.map((m) => m.toLowerCase()));

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
    if (accessors.amount && (state.amountMin.trim() || state.amountMax.trim())) {
      if (!inRange(toNum(accessors.amount(item)), state.amountMin, state.amountMax))
        return false;
    }
    if (
      accessors.balance &&
      (state.balanceMin.trim() || state.balanceMax.trim())
    ) {
      if (
        !inRange(toNum(accessors.balance(item)), state.balanceMin, state.balanceMax)
      )
        return false;
    }
    if (
      accessors.creditLimit &&
      (state.creditLimitMin.trim() || state.creditLimitMax.trim())
    ) {
      if (
        !inRange(
          toNum(accessors.creditLimit(item)),
          state.creditLimitMin,
          state.creditLimitMax
        )
      )
        return false;
    }
    if (methods.size > 0 && accessors.paymentMethod) {
      const m = (accessors.paymentMethod(item) || "").toLowerCase();
      if (!methods.has(m)) return false;
    }
    return true;
  });
}

/** Query-string shape for list APIs. */
export function staffListFilterParams(
  state: StaffListFilterState,
  extra?: Record<string, string>
): Record<string, string> {
  const params: Record<string, string> = { ...(extra || {}) };
  if (state.search.trim()) params.q = state.search.trim();
  if (state.from.trim()) params.from = state.from.trim();
  if (state.to.trim()) params.to = state.to.trim();
  if (state.statuses.length === 1) params.status = state.statuses[0];
  else if (state.statuses.length > 1)
    params.status = state.statuses.join(",");
  if (state.categories.length === 1) params.category = state.categories[0];
  else if (state.categories.length > 1)
    params.category = state.categories.join(",");
  if (state.amountMin.trim()) params.amount_min = state.amountMin.trim();
  if (state.amountMax.trim()) params.amount_max = state.amountMax.trim();
  if (state.balanceMin.trim()) params.balance_min = state.balanceMin.trim();
  if (state.balanceMax.trim()) params.balance_max = state.balanceMax.trim();
  if (state.creditLimitMin.trim())
    params.credit_limit_min = state.creditLimitMin.trim();
  if (state.creditLimitMax.trim())
    params.credit_limit_max = state.creditLimitMax.trim();
  if (state.paymentMethods.length)
    params.payment_method = state.paymentMethods.join(",");
  return params;
}

export function staffListFilterQuery(
  state: StaffListFilterState,
  extra?: Record<string, string>
): string {
  const params = staffListFilterParams(state, extra);
  const sp = new URLSearchParams(params);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
