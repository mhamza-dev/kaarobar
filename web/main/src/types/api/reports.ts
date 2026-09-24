/**
 * Report figures, mirroring `KaarobarWeb.ReportJSON`: money as decimal
 * strings, counts as numbers, quantities at full precision. Breakdown rows
 * carry ids only — names are resolved on the client from lists it already
 * has (products, categories, staff, branches).
 */

export type ReportPeriod = { from: string; to: string; branch_id?: string };

export type DailyRow = {
  day: string;
  sale_count: number;
  voided_count: number;
  gross_sales: string;
  discount_total: string;
  tax_total: string;
  net_sales: string;
  refund_total: string;
  cost_total: string;
};

export type SalesSummary = {
  from: string;
  to: string;
  sale_count: number;
  voided_count: number;
  gross_sales: string;
  discount_total: string;
  tax_total: string;
  net_sales: string;
  refund_total: string;
  cost_total: string;
  gross_profit: string;
  average_sale: string;
  days?: DailyRow[];
};

export type TopProductRow = {
  product_id: string;
  variant_id: string;
  quantity: string;
  refunded_quantity: string;
  net_sales: string;
  cost_total: string;
  margin: string;
};

export type CategoryRow = {
  category_id: string | null;
  quantity: string;
  net_sales: string;
  cost_total: string;
  margin: string;
};

export type TenderRow = { method: string; count: number; total: string };

export type CashierRow = {
  cashier_id: string | null;
  sale_count: number;
  net_sales: string;
  discount_total: string;
};

export type BranchRow = {
  branch_id: string;
  sale_count: number;
  net_sales: string;
  refund_total: string;
  cost_total: string;
};

export type HourRow = { hour: number; sale_count: number; net_sales: string };

export type ProfitAndLoss = {
  from: string;
  to: string;
  revenue: string;
  cost_of_sales: string;
  gross_profit: string;
  operating_expenses: string;
  net_profit: string;
  tax_collected: string;
  expenses_by_category: Array<{
    category_id?: string | null;
    name?: string | null;
    total?: string;
    [key: string]: unknown;
  }>;
};

export type TaxRow = {
  name: string;
  label: string | null;
  rate: string;
  taxable_total: string | null;
  tax_total: string;
};

/** Reports `GET /reports/:report/export.csv` accepts (ReportController @exportable). */
export const EXPORTABLE_REPORTS = [
  "daily",
  "top_products",
  "by_tender",
  "by_cashier",
  "by_branch",
  "by_category",
  "tax",
] as const;
export type ExportableReport = (typeof EXPORTABLE_REPORTS)[number];
