/** Mirrors the purchasing half of inventory_serializers.ex. */

import type { ProductVariant } from "./catalog";
import type { Batch } from "./inventory";
import type { Branch } from "./tenancy";

export type SupplierAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: SupplierAddress;
  tax_number: string | null;
  currency: string | null;
  payment_terms_days: number | null;
  credit_limit: string | null;
  /** What is owed to them right now. */
  balance: string | null;
  notes: string | null;
  is_active: boolean;
};

export type PurchaseOrderItem = {
  id: string;
  variant_id: string | null;
  description: string | null;
  supplier_sku: string | null;
  ordered_quantity: string;
  received_quantity: string;
  outstanding_quantity: string;
  fully_received: boolean;
  unit_cost: string | null;
  discount_percent: string | null;
  tax_total: string | null;
  line_total: string | null;
  variant: ProductVariant | null;
};

/**
 * `receivable` and `editable` are computed server-side from the status
 * machine (`PurchaseOrder.receivable?/1`, `editable?/1`). The UI gates its
 * actions on those booleans rather than re-deriving the rules from
 * `status`, so the two can never disagree.
 */
export type PurchaseOrder = {
  id: string;
  number: string;
  status: "draft" | "approved" | "partial" | "received" | "cancelled" | "closed" | string;
  supplier_id: string;
  branch_id: string;
  ordered_on: string | null;
  expected_on: string | null;
  currency: string | null;
  subtotal: string | null;
  tax_total: string | null;
  shipping_total: string | null;
  total: string | null;
  reference: string | null;
  notes: string | null;
  receivable: boolean;
  editable: boolean;
  supplier: Supplier | null;
  branch: Branch | null;
  items?: PurchaseOrderItem[];
  inserted_at: string;
};

export type GoodsReceiptItem = {
  id: string;
  variant_id: string | null;
  purchase_order_item_id: string | null;
  quantity: string;
  rejected_quantity: string;
  accepted_quantity: string;
  unit_cost: string | null;
  batch_id: string | null;
  batch_number: string | null;
  manufactured_on: string | null;
  expires_on: string | null;
  serials: string[] | null;
  note: string | null;
  batch: Batch | null;
  variant: ProductVariant | null;
};

export type GoodsReceipt = {
  id: string;
  number: string;
  status: string;
  supplier_id: string;
  branch_id: string;
  purchase_order_id: string | null;
  received_on: string | null;
  supplier_reference: string | null;
  subtotal: string | null;
  tax_total: string | null;
  shipping_total: string | null;
  total: string | null;
  /** Until posted, nothing has moved into stock. */
  posted: boolean;
  posted_at: string | null;
  notes: string | null;
  supplier: Supplier | null;
  purchase_order: PurchaseOrder | null;
  items?: GoodsReceiptItem[];
  inserted_at: string;
};

export type SupplierBillItem = {
  id: string;
  variant_id: string | null;
  description: string | null;
  quantity: string;
  unit_cost: string | null;
  tax_total: string | null;
  line_total: string | null;
};

export type SupplierBill = {
  id: string;
  number: string;
  supplier_invoice_number: string | null;
  status: string;
  supplier_id: string;
  goods_receipt_id: string | null;
  issued_on: string | null;
  due_on: string | null;
  currency: string | null;
  subtotal: string | null;
  tax_total: string | null;
  total: string | null;
  paid_total: string | null;
  outstanding: string | null;
  overdue: boolean;
  notes: string | null;
  supplier: Supplier | null;
  items?: SupplierBillItem[];
  inserted_at: string;
};

export type PurchaseReturnItem = {
  id: string;
  variant_id: string | null;
  batch_id: string | null;
  quantity: string;
  unit_cost: string | null;
  line_total: string | null;
  note: string | null;
  variant: ProductVariant | null;
};

export type PurchaseReturn = {
  id: string;
  number: string;
  status: string;
  supplier_id: string;
  branch_id: string;
  goods_receipt_id: string | null;
  reason: string | null;
  returned_on: string | null;
  subtotal: string | null;
  tax_total: string | null;
  total: string | null;
  notes: string | null;
  supplier: Supplier | null;
  items?: PurchaseReturnItem[];
  inserted_at: string;
};

/** `GET /supplier-bills/ageing` — the buckets a payables screen leads with. */
export type PayablesAgeing = {
  current: string;
  overdue_1_30: string;
  overdue_31_60: string;
  overdue_61_90?: string;
  overdue_90_plus?: string;
  total?: string;
};

export type SupplierPayload = {
  name: string;
  code?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address_line1?: string | null;
  city?: string | null;
  tax_number?: string | null;
  payment_terms_days?: number | null;
  credit_limit?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export type PurchaseOrderPayload = {
  supplier_id: string;
  branch_id: string;
  expected_on?: string | null;
  reference?: string | null;
  notes?: string | null;
  items: Array<{
    variant_id: string;
    ordered_quantity: string;
    unit_cost: string;
    description?: string;
  }>;
};

export type GoodsReceiptPayload = {
  supplier_id: string;
  branch_id: string;
  purchase_order_id?: string | null;
  received_on?: string | null;
  supplier_reference?: string | null;
  notes?: string | null;
  items: Array<{
    variant_id: string;
    purchase_order_item_id?: string | null;
    quantity: string;
    unit_cost: string;
    rejected_quantity?: string;
    batch_number?: string;
    expires_on?: string | null;
  }>;
};

/** `GET /suppliers/:id/products` — what one supplier charges for a variant. */
export type SupplierProduct = {
  id: string;
  supplier_id: string;
  variant_id: string;
  supplier_sku: string | null;
  supplier_name: string | null;
  unit_cost: string | null;
  minimum_order_quantity: string | null;
  pack_size: string | null;
  lead_time_days: number | null;
  is_preferred: boolean;
  is_active: boolean;
  last_purchased_at: string | null;
  variant: ProductVariant | null;
};

export type SupplierProductPayload = {
  variant_id: string;
  unit_cost: string;
  supplier_sku?: string | null;
  minimum_order_quantity?: string | null;
  lead_time_days?: number | null;
  is_active?: boolean;
};

export type SupplierLedgerEntry = {
  id: string;
  supplier_id: string;
  kind: "opening" | "bill" | "payment" | "credit_note" | "adjustment" | string;
  /** Signed: a bill raises what is owed, a payment lowers it. */
  amount: string;
  balance_after: string;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  occurred_at: string;
  actor: { id: string | null; label: string | null };
};

/** `GET /suppliers/:id/ledger`, oldest entry first. */
export type SupplierLedger = {
  supplier: Supplier;
  balance: string;
  entries: SupplierLedgerEntry[];
};

export const SUPPLIER_PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "cheque",
  "card",
  "wallet",
  "other",
] as const;

export type SupplierPayment = {
  id: string;
  number: string;
  supplier_id: string;
  method: string;
  amount: string;
  /** Paid but not matched to a bill — money on account. */
  unallocated_amount: string;
  currency: string;
  paid_on: string;
  reference: string | null;
  notes: string | null;
  allocations?: Array<{ id: string; supplier_bill_id: string; amount: string }>;
};

export type SupplierPaymentPayload = {
  supplier_id: string;
  amount: string;
  method: string;
  paid_on?: string;
  reference?: string | null;
  notes?: string | null;
  /** Bill id → amount. The backend takes a map, not a list. */
  allocations?: Record<string, string>;
};

export type SupplierBillPayload = {
  supplier_id: string;
  goods_receipt_id?: string | null;
  supplier_invoice_number?: string | null;
  issued_on?: string | null;
  /** Defaults server-side to the supplier's payment terms. */
  due_on?: string | null;
  notes?: string | null;
  items: Array<{
    variant_id?: string | null;
    description: string;
    quantity: string;
    unit_cost: string;
  }>;
};

export type PurchaseReturnPayload = {
  supplier_id: string;
  branch_id: string;
  goods_receipt_id?: string | null;
  reason?: string | null;
  returned_on: string;
  notes?: string | null;
  items: Array<{ variant_id: string; quantity: string; unit_cost: string; note?: string }>;
};
