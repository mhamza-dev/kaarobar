/**
 * Mirrors backend/lib/backend_web/inventory_serializers.ex.
 *
 * Quantities are strings for the same reason money is — a shop selling
 * 1.250 kg of mince should not have that arrive as a float. Render them
 * through `src/lib/format.ts`; never with arithmetic on the way.
 */

import type { ProductVariant } from "./catalog";
import type { Branch } from "./tenancy";

export type StockItem = {
  id: string;
  branch_id: string;
  variant_id: string;
  on_hand: string;
  reserved: string;
  /** on_hand minus reserved — what a cashier can actually sell. */
  available: string;
  incoming: string;
  average_cost: string | null;
  value: string | null;
  reorder_point: string | null;
  reorder_quantity: string | null;
  max_stock: string | null;
  below_reorder_point: boolean;
  bin_location: string | null;
  last_counted_at: string | null;
  last_movement_at: string | null;
  branch: Branch | null;
  variant: ProductVariant | null;
};

/** One line of the stock ledger. `kind` says why it moved. */
export type StockMove = {
  id: string;
  branch_id: string;
  variant_id: string;
  kind: string;
  quantity: string;
  unit_cost: string | null;
  total_cost: string | null;
  /** Running total, so the ledger reads as an account. */
  balance_after: string;
  batch_id: string | null;
  serial_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  note: string | null;
  actor: { id: string | null; label: string | null };
  occurred_at: string;
  batch: Batch | null;
  variant: ProductVariant | null;
};

export type Batch = {
  id: string;
  variant_id: string;
  batch_number: string;
  manufactured_on: string | null;
  expires_on: string | null;
  days_until_expiry: number | null;
  expired: boolean;
  sellable: boolean;
  supplier_id: string | null;
  received_quantity: string;
  remaining_quantity: string;
  unit_cost: string | null;
  status: string;
  note: string | null;
  variant: ProductVariant | null;
};

export type TransferItem = {
  id: string;
  variant_id: string;
  batch_id: string | null;
  quantity: string;
  received_quantity: string;
  shortfall: string;
  /** True when less arrived than was sent — the thing a receiver must notice. */
  short: boolean;
  unit_cost: string | null;
  note: string | null;
  variant: ProductVariant | null;
};

export type StockTransfer = {
  id: string;
  number: string;
  status: "draft" | "dispatched" | "received" | "cancelled" | string;
  source_branch_id: string;
  destination_branch_id: string;
  dispatched_at: string | null;
  received_at: string | null;
  in_transit: boolean;
  notes: string | null;
  source_branch: Branch | null;
  destination_branch: Branch | null;
  items?: TransferItem[];
  inserted_at: string;
};

export type StockCountItem = {
  id: string;
  variant_id: string;
  batch_id: string | null;
  expected_quantity: string;
  counted_quantity: string | null;
  variance: string | null;
  variance_value: string | null;
  unit_cost: string | null;
  counted: boolean;
  adjusts_stock: boolean;
  counted_at: string | null;
  reason: string | null;
  note: string | null;
  variant: ProductVariant | null;
};

export type StockCount = {
  id: string;
  number: string;
  status: "draft" | "counting" | "submitted" | "approved" | "cancelled" | string;
  kind: string;
  branch_id: string;
  category_id: string | null;
  started_at: string | null;
  counted_at: string | null;
  approved_at: string | null;
  /** The size of what an approver is being asked to accept. */
  variance_quantity: string | null;
  variance_value: string | null;
  line_count: number;
  notes: string | null;
  branch: Branch | null;
  items?: StockCountItem[];
  inserted_at: string;
};

/** Query params `GET /stock` accepts (InventoryController @stock_filters). */
export type StockListParams = {
  branch_id?: string;
  variant_id?: string;
  category_id?: string;
  low_stock?: boolean;
  in_stock?: boolean;
  q?: string;
};

export type StockMoveParams = {
  branch_id?: string;
  variant_id?: string;
  batch_id?: string;
  kind?: string;
};

/**
 * `POST /stock/adjust` and `POST /stock/write-off`.
 *
 * A reason is required by the backend (`require_reason/1`) — stock that
 * changes without one is indistinguishable from shrinkage.
 */
export type StockAdjustPayload = {
  variant_id: string;
  branch_id: string;
  /** Signed for an adjustment; the write-off endpoint takes the amount lost. */
  quantity: string;
  reason: string;
  batch_id?: string;
  unit_cost?: string;
  note?: string;
};

export type TransferPayload = {
  source_branch_id: string;
  destination_branch_id: string;
  notes?: string;
  items: Array<{ variant_id: string; quantity: string; batch_id?: string; note?: string }>;
};

export type CountPayload = {
  branch_id: string;
  kind?: string;
  category_id?: string;
  notes?: string;
};

/** `PUT /stock/:branch_id/:variant_id` — the per-branch reorder settings. */
export type StockSettingsPayload = {
  reorder_point?: string | null;
  reorder_quantity?: string | null;
  max_stock?: string | null;
  bin_location?: string | null;
};

/** `POST /stock/opening` — what a business starts with, at what it cost. */
export type OpeningStockPayload = {
  variant_id: string;
  branch_id: string;
  quantity: string;
  unit_cost: string;
};

/** `GET /stock/valuation` — quantity on hand and what it cost. */
export type StockValuation = { quantity: string; value: string };

/** `GET /stock/reorder` — a line below its reorder point, and how many to order. */
export type ReorderSuggestion = {
  variant_id: string;
  branch_id: string;
  available: string;
  reorder_point: string;
  incoming: string;
  suggested_quantity: string;
  variant: ProductVariant | null;
};

export const BATCH_STATUSES = ["active", "depleted", "expired", "quarantined", "recalled"] as const;
