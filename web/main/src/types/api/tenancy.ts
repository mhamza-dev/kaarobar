/** Mirrors backend/lib/backend_web/serializers.ex — kept in sync by hand. */

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  confirmed: boolean;
  mfa_enabled: boolean;
  status: "active" | "suspended" | "deleted";
  last_login_at: string | null;
  inserted_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  country_code: string | null;
  default_currency: string;
  timezone: string;
  default_locale: string;
  status: string;
  owner_id: string;
  settings: Record<string, unknown>;
  inserted_at: string;
};

export type BranchAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
};

export type Branch = {
  id: string;
  business_id: string;
  name: string;
  code: string | null;
  address: BranchAddress;
  phone: string | null;
  email: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string;
  is_main: boolean;
  is_warehouse: boolean;
  opening_hours: Record<string, unknown> | null;
  status: string;
  inserted_at: string;
};

/**
 * A business's `modules`/`product_kinds`/`requires_batch` are resolved
 * server-side from its `business_type` (Kaarobar.Verticals) — this is the
 * authoritative source for nav/feature gating (see src/lib/nav.ts), not a
 * frontend copy of the vertical→module matrix.
 */
export type Business = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  business_type: string;
  business_type_label: string;
  currency: string;
  timezone: string;
  default_locale: string;
  legal_name: string | null;
  tax_number: string | null;
  license_number: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  brand_color: string | null;
  prices_include_tax: boolean;
  modules: string[];
  product_kinds: string[];
  required_sale_fields: string[];
  requires_batch: boolean;
  social: Record<string, unknown>;
  receipt_settings: Record<string, unknown>;
  settings: Record<string, unknown>;
  status: string;
  branches?: Branch[];
  inserted_at: string;
};
