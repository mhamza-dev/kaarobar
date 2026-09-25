/**
 * Mirrors backend/lib/backend_web/catalog_serializers.ex.
 *
 * Money and quantities arrive as **strings**, not numbers — deliberate on
 * the backend's side (`JSONHelpers`: a price that reaches a browser as an
 * IEEE-754 double has already lost precision). Keep them strings here too;
 * parse only at the point of arithmetic.
 */

/** Every product kind the platform understands (`Catalog.Product` @kinds). */
export const PRODUCT_KINDS = [
  "item",
  "service",
  "bundle",
  "deal",
  "rental",
  "membership",
  "gift_card",
  "fee",
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** The kinds that may carry a stock level (`@stockable_kinds`). */
export const STOCKABLE_KINDS: ProductKind[] = ["item", "rental"];

export type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  depth: number;
  /** Ancestry, so the client builds its tree without re-deriving it. */
  ancestor_ids: string[];
  sort_order: number;
  is_active: boolean;
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
};

export type Unit = {
  id: string;
  code: string;
  name: string;
  dimension: string;
  factor_to_base: string;
  precision: number;
  is_base: boolean;
  is_active: boolean;
};

export type VariantOptionValue = {
  option_type_id?: string;
  option_type?: string;
  value: string;
  hex_color?: string | null;
};

/** The trimmed product nested inside a variant (`product_summary/1`). */
export type ProductSummary = {
  id: string;
  name: string;
  kind: ProductKind;
  image_url: string | null;
  tracks_stock: boolean;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  sku: string | null;
  name: string | null;
  barcode: string | null;
  price: string | null;
  cost: string | null;
  compare_at_price: string | null;
  margin: string | null;
  weight_grams: string | null;
  image_url: string | null;
  is_default: boolean;
  position: number;
  is_active: boolean;
  option_values: VariantOptionValue[];
  /** Alternate barcodes, beyond `barcode` — on the product detail only. */
  barcodes?: ProductBarcode[] | null;
  /** Present only where the backend preloaded it — stock rows, ledger lines. */
  product?: ProductSummary | null;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  kind: ProductKind;

  // Kind-dependent fields. Which of these apply is decided by `kind` — see
  // `src/lib/productKinds.ts`, which mirrors the backend's rules so the form
  // only shows what the backend will actually accept.
  tracks_stock: boolean;
  tracks_batch: boolean;
  tracks_serial: boolean;
  is_weighted: boolean;
  service_duration_minutes: number | null;
  kitchen_station_id: string | null;
  hazard_class: string | null;
  registration_number: string | null;
  requires_prescription: boolean;
  rental_period_minutes: number | null;
  membership_days: number | null;

  attributes: Record<string, unknown>;
  image_url: string | null;
  images: string[];
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;

  category_id: string | null;
  brand_id: string | null;
  unit_id: string | null;
  tax_group_id: string | null;

  category: Category | null;
  brand: Brand | null;
  unit: Unit | null;
  variants?: ProductVariant[];
  /** Attached add-on groups — on the product detail only. */
  modifier_groups?: ModifierGroup[] | null;
  inserted_at: string;
};

/** Query params `GET /products` accepts (ProductController @filter_keys). */
export type ProductListParams = {
  /** Matches name, SKU or barcode — server-side, not a client filter. */
  q?: string;
  category_id?: string;
  brand_id?: string;
  kind?: ProductKind;
  active?: boolean;
  in_category_tree?: string;
};

export type ProductPayload = Partial<
  Omit<Product, "id" | "category" | "brand" | "unit" | "variants" | "inserted_at">
>;

export type VariantPayload = {
  sku?: string | null;
  name?: string | null;
  barcode?: string | null;
  price?: string | null;
  cost?: string | null;
  is_active?: boolean;
};

export type CategoryPayload = {
  name: string;
  parent_id?: string | null;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

// --- Catalog set-up ---------------------------------------------------------------

export const BARCODE_KINDS = [
  "ean13",
  "ean8",
  "upca",
  "upce",
  "code128",
  "code39",
  "qr",
  "internal",
] as const;

export type ProductBarcode = {
  id: string;
  variant_id: string;
  barcode: string;
  kind: (typeof BARCODE_KINDS)[number] | string;
  embedded_value: "weight" | "price" | "quantity" | null;
};

/** `rate` is a fraction for percentage taxes — 0.17 is 17% — and an amount for fixed ones. */
export type Tax = {
  id: string;
  name: string;
  code: string | null;
  label: string;
  kind: "percentage" | "fixed";
  rate: string;
  jurisdiction: string | null;
  is_compound: boolean;
  is_active: boolean;
};

export type TaxPayload = {
  name: string;
  code?: string | null;
  label?: string | null;
  kind: "percentage" | "fixed";
  rate: string;
  jurisdiction?: string | null;
  is_compound?: boolean;
  is_active?: boolean;
};

/** A set of taxes a product carries together; one is the business default. */
export type TaxGroup = {
  id: string;
  name: string;
  code: string | null;
  is_default: boolean;
  is_exempt: boolean;
  is_active: boolean;
  taxes: Tax[];
};

export type TaxGroupPayload = {
  name: string;
  code?: string | null;
  is_exempt?: boolean;
  is_active?: boolean;
  /** Replaces the group's taxes wholesale, in this order. */
  tax_ids?: string[];
};

export const UNIT_DIMENSIONS = ["count", "weight", "volume", "length", "time"] as const;

export type UnitPayload = {
  code: string;
  name: string;
  dimension: (typeof UNIT_DIMENSIONS)[number];
  factor_to_base: string;
  precision?: number;
  is_base?: boolean;
};

export type OptionValue = {
  id: string;
  option_type_id: string;
  value: string;
  hex_color: string | null;
  position: number;
};

/** A kind of choice a variant is made of — Size, Colour — with its values. */
export type OptionType = {
  id: string;
  name: string;
  presentation: string | null;
  position: number;
  is_active: boolean;
  values: OptionValue[] | null;
};

export type Modifier = {
  id: string;
  modifier_group_id: string;
  name: string;
  price_delta: string | null;
  cost_delta: string | null;
  consumes_variant_id: string | null;
  consumes_quantity: string | null;
  is_default: boolean;
  position: number;
  is_active: boolean;
};

/** Add-ons a till offers with a product — extra cheese, less sugar. */
export type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  selection: "single" | "multiple";
  min_select: number | null;
  max_select: number | null;
  required: boolean;
  position: number;
  is_active: boolean;
  modifiers: Modifier[] | null;
};
