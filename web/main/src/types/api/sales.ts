/**
 * Mirrors backend/lib/backend_web/sales_serializers.ex.
 *
 * The central contract of this domain: **the client never computes money.**
 * `Kaarobar.Sales.Checkout` prices the basket from the catalog, price lists,
 * promotions and tax setup; the till sends what was scanned and what was
 * tendered. Every figure typed here therefore arrives from the server —
 * either from `POST /sales/quote` before the sale, or from the sale itself
 * after it.
 */

import type { ProductVariant } from "./catalog";
import type { Customer } from "./crm";
import type { User } from "./tenancy";

/** `Kaarobar.Sales.Payment` @methods. */
export const PAYMENT_METHODS = [
  "cash",
  "card",
  "wallet",
  "bank_transfer",
  "cheque",
  "credit",
  "gift_card",
  "loyalty",
  "store_credit",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Only cash takes a tendered amount and gives change. */
export const CASH_METHODS: PaymentMethod[] = ["cash"];
/** Credit defers payment onto the customer's ledger, so it needs a customer. */
export const DEFERRED_METHODS: PaymentMethod[] = ["credit"];

export type Register = {
  id: string;
  name: string;
  code: string | null;
  branch_id: string;
  invoice_prefix: string | null;
  invoice_series: string | null;
  receipt_settings: Record<string, unknown>;
  settings: Record<string, unknown>;
  is_active: boolean;
};

export type Shift = {
  id: string;
  number: string;
  status: "open" | "closed" | string;
  branch_id: string;
  register_id: string;
  opened_at: string | null;
  closed_at: string | null;
  opening_float: string | null;
  sales_count: number;
  gross_sales: string | null;
  discount_total: string | null;
  tax_total: string | null;
  refund_total: string | null;
  net_sales: string | null;
  /** Keyed by payment method. */
  tender_totals: Record<string, string> | null;
  cash_in: string | null;
  cash_out: string | null;
  /** Live while the shift is open, snapshotted once closed. */
  expected_cash: string | null;
  declared_cash: string | null;
  declared_tenders: Record<string, string> | null;
  cash_variance: string | null;
  balanced: boolean;
  notes: string | null;
  register: Register | null;
  opened_by: User | null;
  closed_by: User | null;
};

export type CashMovement = {
  id: string;
  shift_id: string;
  kind: "pay_in" | "pay_out" | "drop" | "float_adjustment" | string;
  amount: string;
  outward: boolean;
  reason: string | null;
  reference: string | null;
  note: string | null;
  actor_label: string | null;
  occurred_at: string;
};

export const CASH_MOVEMENT_KINDS = ["pay_in", "pay_out", "drop", "float_adjustment"] as const;

export type SaleItemTax = {
  name?: string;
  rate?: string;
  amount?: string;
};

export type SaleItem = {
  id: string;
  variant_id: string;
  product_id: string;
  /** Snapshotted at the time of sale — renaming a product never rewrites history. */
  name: string;
  sku: string | null;
  unit: string | null;
  quantity: string;
  refunded_quantity: string;
  refundable_quantity: string;
  list_price: string | null;
  unit_price: string | null;
  discount_total: string | null;
  modifier_total: string | null;
  net_total: string | null;
  tax_total: string | null;
  line_total: string | null;
  cost_snapshot: string | null;
  margin: string | null;
  applied_rule_ids: string[] | null;
  batch_id: string | null;
  seat_number: number | null;
  position: number;
  note: string | null;
  taxes?: SaleItemTax[];
  variant: ProductVariant | null;
};

export type Payment = {
  id: string;
  method: PaymentMethod | string;
  amount: string;
  tendered_amount: string | null;
  change_due: string | null;
  refunded_amount: string | null;
  refundable_amount: string | null;
  currency: string;
  reference: string | null;
  card_last_four: string | null;
  card_scheme: string | null;
  status: string;
  occurred_at: string;
};

export type Sale = {
  id: string;
  number: string;
  status: "completed" | "voided" | "refunded" | "partially_refunded" | string;
  channel: string;
  currency: string;
  branch_id: string;
  register_id: string | null;
  shift_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  subtotal: string | null;
  discount_total: string | null;
  order_discount: string | null;
  tax_total: string | null;
  rounding: string | null;
  total: string | null;
  paid_total: string | null;
  change_due: string | null;
  refunded_total: string | null;
  refundable_amount: string | null;
  cost_total: string | null;
  margin: string | null;
  prices_include_tax: boolean;
  service_mode: string | null;
  served_by_user_id: string | null;
  cashier_id: string | null;
  cashier_label: string | null;
  notes: string | null;
  discount_reason: string | null;
  /** Present in regimes that issue them — the receipt isn't a tax invoice without these. */
  fiscal_number: string | null;
  fiscal_qr_payload: string | null;
  fiscal_status: string | null;
  voided_at: string | null;
  void_reason: string | null;
  sold_at: string | null;
  items?: SaleItem[];
  payments?: Payment[];
  customer?: Customer | null;
  register?: Register | null;
  cashier?: User | null;
};

/** The cursor-paginated list shape — deliberately smaller than a full sale. */
export type SaleSummary = {
  id: string;
  number: string;
  status: string;
  currency: string;
  total: string | null;
  refunded_total: string | null;
  customer_id: string | null;
  cashier_label: string | null;
  sold_at: string | null;
};

// --- Quoting ---------------------------------------------------------------

export type QuoteDiscount = {
  name?: string;
  amount?: string;
};

export type QuoteLine = {
  variant_id: string;
  name: string;
  quantity: string;
  unit_price: string;
  discounts: QuoteDiscount[];
  order_discount: string | null;
  net: string;
  tax_total: string;
  tax_lines: SaleItemTax[];
  total: string;
};

export type QuoteTotals = {
  subtotal: string;
  discount_total: string;
  order_discount: string;
  tax_total: string;
  rounding: string;
  total: string;
};

/**
 * `POST /sales/quote` — the priced basket.
 *
 * This is the only source of truth for what the cart is worth. The checkout
 * screen re-quotes whenever the basket changes and renders these figures
 * verbatim.
 */
export type SaleQuote = {
  totals: QuoteTotals;
  lines: QuoteLine[];
};

/** One scanned line, as the client describes it — quantity, never price. */
export type CheckoutLine = {
  variant_id: string;
  quantity: string;
  modifier_ids?: string[];
  batch_id?: string;
  note?: string;
  /** Permission-gated (`sale:price_override`), recorded on the sale. */
  unit_price?: string;
};

export type CheckoutPayment = {
  method: PaymentMethod | string;
  amount: string;
  /** Cash only — what the customer handed over, so change can be computed. */
  tendered_amount?: string;
  reference?: string;
};

export type CheckoutPayload = {
  /**
   * Required unless the caller's session already resolves one. `/me` returns
   * no branch for an owner who works across several, so the till sends the
   * register's own branch — which is where the sale physically happens.
   */
  branch_id?: string;
  register_id?: string;
  shift_id?: string;
  customer_id?: string;
  order_id?: string;
  lines: CheckoutLine[];
  payments: CheckoutPayment[];
  order_discount?: string;
  discount_reason?: string;
  notes?: string;
  service_mode?: string;
};

export type RefundRequestItem = {
  id: string;
  sale_item_id: string;
  quantity: string;
  /** False when the goods are faulty — written off rather than put back. */
  restock: boolean;
  reason: string | null;
};

/**
 * Asking to give money back, as distinct from doing it: the person who made
 * the sale shouldn't be the one who approves undoing it. Pending → approved
 * or rejected; approved → completed once the return is processed.
 */
export type RefundRequest = {
  id: string;
  number: string;
  status: "pending" | "approved" | "rejected" | "completed" | string;
  sale_id: string;
  branch_id: string;
  reason: string | null;
  requested_amount: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  items?: RefundRequestItem[];
  sale?: SaleSummary | null;
  requested_by?: User | null;
  reviewed_by?: User | null;
};

export type ReturnLine = {
  sale_item_id: string;
  quantity: string;
  restock: boolean;
  reason?: string;
};

export type RefundRequestPayload = {
  reason: string;
  items: ReturnLine[];
};

export type SaleReturnItem = {
  id: string;
  sale_item_id: string;
  variant_id: string | null;
  name: string;
  quantity: string;
  unit_price: string | null;
  tax_total: string | null;
  line_total: string | null;
  restock: boolean;
  reason: string | null;
};

/** Goods taken back and money given back, against a sale. */
export type SaleReturn = {
  id: string;
  number: string;
  sale_id: string;
  customer_id: string | null;
  refund_request_id: string | null;
  branch_id: string;
  shift_id: string | null;
  reason: string | null;
  subtotal: string | null;
  tax_total: string | null;
  total: string | null;
  processed_by_label: string | null;
  returned_at: string | null;
  notes: string | null;
  items?: SaleReturnItem[];
  sale?: SaleSummary | null;
};

/** `GET /shifts/:id/reconcile` — the running totals against the same figures recomputed. */
export type ShiftFigures = {
  sales_count: number;
  gross_sales: string;
  tax_total: string;
  discount_total: string;
  tenders: Record<string, string> | null;
};

export type ShiftReconciliation = {
  recorded: ShiftFigures;
  computed: ShiftFigures;
  agrees: boolean;
};
