/**
 * Mirrors `SalesSerializers.customer/1`.
 *
 * Phase 4 needs customers for credit sales and receipts; Phase 5 builds the
 * customer screens proper on top of this.
 */
export type Customer = {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  tax_number: string | null;
  date_of_birth: string | null;
  notes: string | null;
  balance: string | null;
  credit_limit: string | null;
  credit_allowed: boolean;
  /**
   * What is left to spend on account. `SalesSerializers.customer/1` sends the
   * literal `"unlimited"` for an uncapped line — never a very large number —
   * while the credit statement sends `null` for the same thing.
   */
  available_credit: string | "unlimited" | null;
  owing: boolean;
  is_active: boolean;
};

export type CustomerGroup = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  price_list_id: string | null;
  discount_percent: string | null;
  payment_terms_days: number | null;
  credit_limit: string | null;
  credit_allowed: boolean;
  loyalty_multiplier: string | null;
  is_default: boolean;
  is_active: boolean;
};

export type CustomerAddress = {
  id: string;
  customer_id: string;
  label: string | null;
  kind: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: string | null;
  longitude: string | null;
  delivery_notes: string | null;
  is_default: boolean;
  /** Pre-joined by the backend, so the client never assembles an address. */
  one_line: string | null;
};

export type CustomerContact = {
  id: string;
  customer_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_primary: boolean;
};

export type CustomerNote = {
  id: string;
  customer_id: string;
  body: string;
  is_pinned: boolean;
  author_label: string | null;
  inserted_at: string;
};

export const FOLLOW_UP_KINDS = [
  "task",
  "call",
  "visit",
  "payment_chase",
  "delivery",
  "other",
] as const;

export type FollowUp = {
  id: string;
  customer_id: string;
  customer?: Customer | null;
  title: string;
  body: string | null;
  kind: string;
  status: "open" | "done" | "cancelled" | string;
  due_on: string | null;
  /** Server-computed against today — never re-derived from due_on here. */
  overdue: boolean;
  assigned_to_id: string | null;
  completed_at: string | null;
  outcome: string | null;
};

/** `Customers.FollowUp` @statuses. */
export const FOLLOW_UP_STATUSES = ["open", "done", "cancelled"] as const;

/** One line of the customer's account — what moved their balance and why. */
export type CustomerLedgerEntry = {
  id: string;
  kind: string;
  amount: string | null;
  balance_after: string | null;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  actor_label: string | null;
  occurred_at: string;
};

/** An unpaid credit sale, as the ageing report sees it. */
export type CreditInvoice = {
  sale_id: string;
  number: string;
  customer_id: string;
  customer_name: string | null;
  sold_at: string | null;
  due_on: string | null;
  charged: string | null;
  allocated: string | null;
  outstanding: string | null;
  days_overdue: number | null;
};

/** `GET /credit/ageing` — the buckets a receivables screen leads with. */
export type CreditAgeing = {
  current: string | null;
  days_1_30: string | null;
  days_31_60: string | null;
  days_61_90: string | null;
  days_over_90: string | null;
  total: string | null;
  as_of: string | null;
  invoice_count: number | null;
};

export type CustomerAgeing = CreditAgeing & {
  customer_id: string;
  customer_name: string | null;
  oldest_days_overdue: number | null;
};

export type CustomerStatement = {
  customer: Customer;
  balance: string | null;
  outstanding: string | null;
  credit_limit: string | null;
  available_credit: string | null;
  entries: CustomerLedgerEntry[];
  open_invoices: CreditInvoice[];
};

export type LoyaltyProgram = {
  id: string;
  name: string;
  points_label: string | null;
  earn_rate: string | null;
  redeem_rate: string | null;
  min_points_to_redeem: number | null;
  max_redeem_percent: string | null;
  points_expire_after_days: number | null;
  earn_on_discounted: boolean;
  earn_on_tax: boolean;
  is_active: boolean;
};

export type LoyaltyAccount = {
  id: string;
  customer_id: string;
  loyalty_program_id: string;
  points_balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  tier: string | null;
  enrolled_at: string | null;
  last_activity_at: string | null;
};

export type LoyaltyTransaction = {
  id: string;
  kind: string;
  points: number;
  balance_after: number;
  value_amount: string | null;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  expires_on: string | null;
  occurred_at: string;
};

/** A customer settling what they owe — `SalesSerializers.customer_payment/1`. */
export type CustomerPayment = {
  id: string;
  number: string;
  customer_id: string;
  method: string;
  amount: string | null;
  paid_on: string | null;
  reference: string | null;
  notes: string | null;
  shift_id: string | null;
};

/** `Customers.CustomerPayment` @methods. */
export const CUSTOMER_PAYMENT_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "wallet",
  "cheque",
  "other",
] as const;

/** `GET /customers/:id/ledger` — the account with its running balance. */
export type CustomerLedger = {
  customer: Customer;
  balance: string | null;
  entries: CustomerLedgerEntry[];
};

/** `Customers.CustomerAddress` @kinds. */
export const ADDRESS_KINDS = ["billing", "shipping", "both"] as const;

export type StoreCredit = {
  id: string;
  number: string;
  customer_id: string;
  currency: string;
  issued_amount: string | null;
  balance: string | null;
  spent: string | null;
  reason: string | null;
  issued_at: string | null;
  expires_on: string | null;
  voided_at: string | null;
  /** Server-computed against today: not voided, not expired, balance left. */
  spendable: boolean;
};

export type CustomerPayload = {
  name: string;
  phone?: string | null;
  email?: string | null;
  code?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  date_of_birth?: string | null;
  tax_number?: string | null;
  notes?: string | null;
  credit_allowed?: boolean;
  credit_limit?: string | null;
  payment_terms_days?: number | null;
  customer_group_id?: string | null;
  is_active?: boolean;
};

/** Query params `GET /customers` accepts (CustomerController customer_filters/1). */
export type CustomerListParams = {
  q?: string;
  credit_allowed?: boolean;
  owing?: boolean;
};
