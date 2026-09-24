/** Mirrors `KaarobarWeb.BillingJSON` — the organization's Kaarobar subscription. */

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  interval: string;
  currency: string;
  amount: string | null;
  trial_days: number | null;
  is_public: boolean;
  features: string[];
  /** `null` value = unlimited; sent explicitly rather than omitted. */
  limits: Record<string, number | null>;
};

export type SubscriptionItem = {
  kind: string;
  quantity: number;
  unit_amount: string | null;
  amount: string | null;
};

/** trialing | active | past_due | paused | canceled | expired */
export type Subscription = {
  id: string;
  status: string;
  provider: string | null;
  currency: string | null;
  plan: Plan | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_until: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  ended_at: string | null;
  items: SubscriptionItem[];
  /** Server-computed: may the organization keep trading on this subscription. */
  serviceable: boolean;
  trialing: boolean;
  days_remaining: number | null;
};

export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string;
  currency: string | null;
  subtotal: string | null;
  tax_total: string | null;
  total: string | null;
  amount_paid: string | null;
  outstanding: string | null;
  period_start: string | null;
  period_end: string | null;
  due_at: string | null;
  paid_at: string | null;
  overdue: boolean;
  attempts: number | null;
  last_error: string | null;
  lines: Array<{
    description: string;
    quantity: number;
    unit_amount: string | null;
    amount: string | null;
  }>;
};
