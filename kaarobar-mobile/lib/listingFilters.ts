export type ListingFilterState = {
  search: string;
  categories: string[];
  priceMin: string;
  priceMax: string;
};

export function emptyListingFilters(): ListingFilterState {
  return { search: "", categories: [], priceMin: "", priceMax: "" };
}

export type ListingAccessors<T> = {
  searchText: (item: T) => string;
  category?: (item: T) => string | null | undefined;
  price?: (item: T) => number;
};

export function applyListingFilters<T>(
  items: T[],
  state: ListingFilterState,
  accessors: ListingAccessors<T>
): T[] {
  const q = state.search.trim().toLowerCase();
  const min = state.priceMin.trim() === "" ? null : Number(state.priceMin);
  const max = state.priceMax.trim() === "" ? null : Number(state.priceMax);
  const cats = new Set(state.categories.map((c) => c.toLowerCase()));

  return items.filter((item) => {
    if (q) {
      const hay = accessors.searchText(item).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (cats.size > 0 && accessors.category) {
      const cat = (accessors.category(item) || "").toLowerCase();
      if (!cats.has(cat)) return false;
    }
    if (accessors.price && (min !== null || max !== null)) {
      const price = accessors.price(item);
      if (!Number.isFinite(price)) return false;
      if (min !== null && Number.isFinite(min) && price < min) return false;
      if (max !== null && Number.isFinite(max) && price > max) return false;
    }
    return true;
  });
}
