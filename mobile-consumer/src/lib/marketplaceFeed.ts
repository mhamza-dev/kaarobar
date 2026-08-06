/** Shared marketplace product feed types and query helpers. */

export type MarketplaceFeedProduct = {
  id: string;
  name: string;
  price?: string | number | null;
  image_url?: string | null;
  category?: string | null;
  product_kind?: string | null;
  business_id: string;
  business_name?: string | null;
  business_slug?: string | null;
  marketplace_slug?: string | null;
  industry?: string | null;
  primary_color?: string | null;
  logo_url?: string | null;
  tagline?: string | null;
  description?: string | null;
  sku?: string | null;
};

export type MarketplaceFeedMeta = {
  limit: number;
  next_cursor: string | null;
};

export type MarketplaceFeedFilters = {
  search: string;
  categories: string[];
  industries: string[];
  priceMin: string;
  priceMax: string;
};

export function emptyMarketplaceFeedFilters(): MarketplaceFeedFilters {
  return { search: "", categories: [], industries: [], priceMin: "", priceMax: "" };
}

export function marketplaceProductsQuery(
  filters: MarketplaceFeedFilters,
  opts?: { cursor?: string | null; limit?: number }
): string {
  const params = new URLSearchParams();
  const q = filters.search.trim();
  if (q) params.set("q", q);
  const categories = filters.categories.map((c) => c.trim()).filter(Boolean);
  if (categories.length) params.set("category", categories.join(","));
  const industries = filters.industries.map((i) => i.trim()).filter(Boolean);
  if (industries.length) params.set("industry", industries.join(","));
  if (filters.priceMin.trim()) params.set("min_price", filters.priceMin.trim());
  if (filters.priceMax.trim()) params.set("max_price", filters.priceMax.trim());
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return `/marketplace/products${qs ? `?${qs}` : ""}`;
}

export function storeKeyForProduct(p: MarketplaceFeedProduct): string {
  return p.business_slug || p.marketplace_slug || p.business_id;
}

export function countMarketplaceAdvancedFilters(
  filters: MarketplaceFeedFilters
): number {
  let n = 0;
  if (filters.categories.length) n += 1;
  if (filters.industries.length) n += 1;
  if (filters.priceMin.trim()) n += 1;
  if (filters.priceMax.trim()) n += 1;
  return n;
}
