/** Mirrors expense_json.ex. */

export const EXPENSE_STATUSES = ["pending", "recorded", "approved", "rejected"] as const;
export const EXPENSE_METHODS = ["cash", "card", "bank", "cheque", "wallet", "other"] as const;
export const EXPENSE_CATEGORY_KINDS = ["operating", "cost_of_sales", "payroll", "tax", "other"] as const;

export type ExpenseCategory = {
  id: string;
  name: string;
  code: string | null;
  kind: (typeof EXPENSE_CATEGORY_KINDS)[number] | string;
  is_active: boolean;
  /** Already in the profit line through each sale's cost — not subtracted again. */
  counted_in_cost_of_sales: boolean;
};

export type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  iban: string | null;
  currency: string;
  balance: string | null;
  opening_balance: string | null;
  is_active: boolean;
};

export type BankAccountPayload = {
  name: string;
  bank_name?: string | null;
  account_number?: string | null;
  iban?: string | null;
  currency?: string;
  opening_balance?: string | null;
  is_active?: boolean;
};

/**
 * Money spent running the business. `recorded` counts straight away;
 * `pending` waits for someone with expense:approve.
 */
export type Expense = {
  id: string;
  number: string;
  description: string;
  amount: string;
  tax_amount: string | null;
  gross: string;
  currency: string;
  method: (typeof EXPENSE_METHODS)[number] | string | null;
  reference: string | null;
  /** The date the money belongs to — not when it was typed in. */
  spent_on: string;
  status: (typeof EXPENSE_STATUSES)[number] | string;
  counts_against_profit: boolean;
  branch_id: string | null;
  category: ExpenseCategory | null;
  bank_account: BankAccount | null;
  supplier_id: string | null;
  recorded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  attachment_path: string | null;
  inserted_at: string;
};

export type ExpensePayload = {
  expense_category_id: string;
  description: string;
  amount: string;
  tax_amount?: string | null;
  method?: string | null;
  bank_account_id?: string | null;
  branch_id?: string | null;
  reference?: string | null;
  spent_on: string;
  /** "pending" to send it for approval; otherwise it counts at once. */
  status?: "pending" | "recorded";
  notes?: string | null;
};

export type ExpenseFilters = {
  from?: string;
  to?: string;
  category_id?: string;
  branch_id?: string;
  status?: string;
};

export type SpendByCategory = {
  /** What comes off gross profit — cost-of-sales rows are excluded. */
  operating_total: string;
  categories: Array<{
    category_id: string;
    category: string;
    kind: string;
    total: string;
    tax_total: string;
    count: number;
    counted_against_profit: boolean;
  }>;
};
