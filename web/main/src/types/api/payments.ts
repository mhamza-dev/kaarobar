/** Mirrors `KaarobarWeb.PaymentJSON`. Credentials never come back — only whether they are set. */

export const PAYMENT_PROVIDERS = ["manual", "jazzcash", "easypaisa", "stripe"] as const;
export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number];

export type PaymentProvider = {
  id: string;
  provider: PaymentProviderKey | string;
  display_name: string;
  mode: "test" | "live" | string;
  public_config: Record<string, unknown> | null;
  webhook_url: string | null;
  is_active: boolean;
  is_default: boolean;
  configured: boolean;
  webhook_configured: boolean;
};

export type PaymentProviderPayload = {
  provider?: string;
  display_name?: string;
  mode?: string;
  /** Write-only. Omit to keep what is stored. */
  credentials?: Record<string, string>;
  webhook_secret?: string;
  is_active?: boolean;
  is_default?: boolean;
};

export type PaymentTransaction = {
  id: string;
  kind: string;
  status: string;
  amount: string | null;
  fee_amount: string | null;
  net_amount: string | null;
  external_id: string | null;
  provider_status: string | null;
  failure_code: string | null;
  failure_message: string | null;
  card_last_four: string | null;
  card_scheme: string | null;
  occurred_at: string | null;
};

/** A gateway payment ("intent") — one attempt to take money through a provider. */
export type PaymentIntent = {
  id: string;
  reference: string | null;
  status: string;
  amount: string | null;
  currency: string | null;
  captured_amount: string | null;
  refunded_amount: string | null;
  external_id: string | null;
  checkout_url: string | null;
  failure_code: string | null;
  failure_message: string | null;
  sale_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  payment_provider_id: string | null;
  authorized_at: string | null;
  captured_at: string | null;
  failed_at: string | null;
  transactions?: PaymentTransaction[] | null;
};

export type Settlement = {
  id: string;
  external_id: string | null;
  /** pending | paid | reconciled | disputed */
  status: string;
  gross_amount: string | null;
  fee_amount: string | null;
  refund_amount: string | null;
  net_amount: string | null;
  /** What the payout differs from the transactions it covers. */
  variance: string | null;
  currency: string | null;
  transaction_count: number | null;
  period_start: string | null;
  period_end: string | null;
  paid_out_at: string | null;
  reconciled_at: string | null;
};
