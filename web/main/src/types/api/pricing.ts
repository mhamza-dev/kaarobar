/** Mirrors the pricing half of catalog_serializers.ex. */

import type { ProductVariant } from "./catalog";

export const PRICE_LIST_KINDS = [
  "base",
  "branch",
  "customer_group",
  "channel",
  "promotion",
  "custom",
] as const;
export const SALES_CHANNELS = ["pos", "online", "phone", "wholesale"] as const;

export type PriceListItem = {
  id: string;
  price_list_id: string;
  variant_id: string;
  price: string;
  /** Quantity breaks: the price applies from this many up. */
  min_quantity: string | null;
  /** With its product — on a single list's detail. */
  variant?: ProductVariant | null;
};

/** A set of prices that override the catalog for a branch, channel or group. */
export type PriceList = {
  id: string;
  name: string;
  code: string | null;
  currency: string;
  kind: (typeof PRICE_LIST_KINDS)[number] | string;
  branch_id: string | null;
  channel: string | null;
  /** Higher wins where two lists price the same thing. */
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  items?: PriceListItem[] | null;
};

export type PriceListPayload = {
  name: string;
  code?: string | null;
  currency?: string;
  kind: string;
  branch_id?: string | null;
  channel?: string | null;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
};

export const PROMOTION_KINDS = [
  "percent_off",
  "amount_off",
  "override_price",
  "bogo",
  "tiered",
  "free_item",
] as const;
export const PROMOTION_SCOPES = ["all", "product", "variant", "category", "brand"] as const;

/** A promotion — the backend calls it a price rule. */
export type PriceRule = {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  kind: (typeof PROMOTION_KINDS)[number] | string;
  scope: (typeof PROMOTION_SCOPES)[number] | string;
  target_id: string | null;
  value: string | null;
  buy_quantity: string | null;
  get_quantity: string | null;
  get_discount_percent: string | null;
  min_quantity: string | null;
  min_subtotal: string | null;
  max_discount_amount: string | null;
  weekdays_mask: number | null;
  start_time: string | null;
  end_time: string | null;
  valid_from: string | null;
  valid_to: string | null;
  branch_ids: string[] | null;
  channel: string | null;
  priority: number;
  stackable: boolean;
  usage_limit: number | null;
  used_count: number;
  requires_code: boolean;
  is_active: boolean;
};

export type PriceRulePayload = Partial<Omit<PriceRule, "id" | "used_count" | "requires_code">> & {
  name: string;
  kind: string;
  scope: string;
};
