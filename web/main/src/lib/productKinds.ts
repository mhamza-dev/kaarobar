import { STOCKABLE_KINDS, type ProductKind } from "@/types/api/catalog";

/**
 * Which product fields apply for a given `kind`.
 *
 * Mirrors `Kaarobar.Catalog.Product`'s rules deliberately, because the
 * backend *corrects* rather than rejects a bad combination
 * (`apply_tracking_rules/1`: `tracks_stock` on a service is silently forced
 * to false). A form that offered those fields would look like it saved
 * something and then show the opposite on reload. Showing only what the
 * backend will honour is the only way the form can be truthful.
 *
 * A business's `requires_batch` vertical (pharmacy and friends) forces
 * `tracks_batch` on server-side; `batchForced` lets the form say so rather
 * than render a checkbox the user cannot actually turn off.
 */
export type ProductFieldRules = {
  /** Only `item` and `rental` may carry a stock level. */
  canTrackStock: boolean;
  /** Batch/serial are meaningless without stock behind them. */
  canTrackBatch: boolean;
  canTrackSerial: boolean;
  canBeWeighted: boolean;
  needsServiceDuration: boolean;
  needsRentalPeriod: boolean;
  needsMembershipDays: boolean;
  /** Bundles and deals are made of other products. */
  hasComponents: boolean;
  /** Kinds that carry a sellable price/SKU through variants. */
  hasVariants: boolean;
};

export function productFieldRules(
  kind: ProductKind,
  options: { tracksStock?: boolean; requiresBatch?: boolean } = {},
): ProductFieldRules {
  const canTrackStock = STOCKABLE_KINDS.includes(kind);
  const tracksStock = canTrackStock && (options.tracksStock ?? false);

  return {
    canTrackStock,
    canTrackBatch: tracksStock,
    canTrackSerial: tracksStock,
    canBeWeighted: kind === "item",
    needsServiceDuration: kind === "service",
    needsRentalPeriod: kind === "rental",
    needsMembershipDays: kind === "membership",
    hasComponents: kind === "bundle" || kind === "deal",
    hasVariants: kind !== "fee",
  };
}

/**
 * Strips fields the chosen kind doesn't support, matching what the backend
 * would coerce anyway — so what the form submits is what comes back.
 */
export function normalizeProductForKind<
  T extends {
    kind: ProductKind;
    tracks_stock?: boolean;
    tracks_batch?: boolean;
    tracks_serial?: boolean;
    is_weighted?: boolean;
    service_duration_minutes?: number | null;
    rental_period_minutes?: number | null;
    membership_days?: number | null;
  },
>(values: T, options: { requiresBatch?: boolean } = {}): T {
  const rules = productFieldRules(values.kind, {
    tracksStock: values.tracks_stock,
    requiresBatch: options.requiresBatch,
  });

  const tracksStock = rules.canTrackStock ? (values.tracks_stock ?? false) : false;

  return {
    ...values,
    tracks_stock: tracksStock,
    // The regulated verticals get batch forced on server-side; mirroring it
    // here keeps the value the user sees and the value that saves identical.
    tracks_batch: tracksStock && (options.requiresBatch || (values.tracks_batch ?? false)),
    tracks_serial: tracksStock && (values.tracks_serial ?? false),
    is_weighted: rules.canBeWeighted ? (values.is_weighted ?? false) : false,
    service_duration_minutes: rules.needsServiceDuration
      ? (values.service_duration_minutes ?? null)
      : null,
    rental_period_minutes: rules.needsRentalPeriod ? (values.rental_period_minutes ?? null) : null,
    membership_days: rules.needsMembershipDays ? (values.membership_days ?? null) : null,
  };
}

const KIND_LABELS: Record<ProductKind, string> = {
  item: "Item",
  service: "Service",
  bundle: "Bundle",
  deal: "Deal",
  rental: "Rental",
  membership: "Membership",
  gift_card: "Gift card",
  fee: "Fee",
};

export function productKindLabel(kind: ProductKind): string {
  return KIND_LABELS[kind] ?? kind;
}
