import { QueryClient } from "@tanstack/react-query";

/**
 * Default QueryClient for desktop POS.
 * Window-focus refetch is off — Electron focus churn is noisy for tills.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 45_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** CRM / Marketing (staff). */
export const crmKeys = {
  all: ["crm"] as const,
  campaigns: (businessId?: string | null) =>
    [...crmKeys.all, "campaigns", businessId ?? null] as const,
  templates: (businessId?: string | null) =>
    [...crmKeys.all, "templates", businessId ?? null] as const,
  templateVariables: (businessId?: string | null) =>
    [...crmKeys.all, "templateVariables", businessId ?? null] as const,
  segments: (businessId?: string | null) =>
    [...crmKeys.all, "segments", businessId ?? null] as const,
  coupons: (businessId?: string | null) =>
    [...crmKeys.all, "coupons", businessId ?? null] as const,
  tiers: (businessId?: string | null) =>
    [...crmKeys.all, "tiers", businessId ?? null] as const,
};

/** Inventory (staff). */
export const inventoryKeys = {
  all: ["inventory"] as const,
  products: (businessId?: string | null) =>
    [...inventoryKeys.all, "products", businessId ?? null] as const,
  stock: (businessId?: string | null) =>
    [...inventoryKeys.all, "stock", businessId ?? null] as const,
  suppliers: (businessId?: string | null) =>
    [...inventoryKeys.all, "suppliers", businessId ?? null] as const,
  purchaseOrders: (businessId?: string | null) =>
    [...inventoryKeys.all, "purchaseOrders", businessId ?? null] as const,
  transfers: (businessId?: string | null) =>
    [...inventoryKeys.all, "transfers", businessId ?? null] as const,
  categories: (businessId?: string | null) =>
    [...inventoryKeys.all, "categories", businessId ?? null] as const,
  branches: (businessId?: string | null) =>
    [...inventoryKeys.all, "branches", businessId ?? null] as const,
};

/** HR & Payroll (staff). */
export const hrKeys = {
  all: ["hr"] as const,
  employees: (businessId?: string | null) =>
    [...hrKeys.all, "employees", businessId ?? null] as const,
  attendance: (businessId?: string | null, params?: string) =>
    [...hrKeys.all, "attendance", businessId ?? null, params ?? ""] as const,
  leave: (businessId?: string | null, params?: string) =>
    [...hrKeys.all, "leave", businessId ?? null, params ?? ""] as const,
  payroll: (businessId?: string | null) =>
    [...hrKeys.all, "payroll", businessId ?? null] as const,
};

/** Accounting (staff). */
export const accountingKeys = {
  all: ["accounting"] as const,
  accounts: (businessId?: string | null) =>
    [...accountingKeys.all, "accounts", businessId ?? null] as const,
  journals: (businessId?: string | null, params?: string) =>
    [...accountingKeys.all, "journals", businessId ?? null, params ?? ""] as const,
  trialBalance: (businessId?: string | null, from?: string, to?: string) =>
    [...accountingKeys.all, "trialBalance", businessId ?? null, from ?? "", to ?? ""] as const,
  profitAndLoss: (businessId?: string | null, from?: string, to?: string) =>
    [...accountingKeys.all, "profitAndLoss", businessId ?? null, from ?? "", to ?? ""] as const,
  balanceSheet: (businessId?: string | null, asOf?: string) =>
    [...accountingKeys.all, "balanceSheet", businessId ?? null, asOf ?? ""] as const,
  cashFlow: (businessId?: string | null, from?: string, to?: string) =>
    [...accountingKeys.all, "cashFlow", businessId ?? null, from ?? "", to ?? ""] as const,
  generalLedger: (
    businessId?: string | null,
    accountId?: string,
    from?: string,
    to?: string
  ) =>
    [
      ...accountingKeys.all,
      "generalLedger",
      businessId ?? null,
      accountId ?? "",
      from ?? "",
      to ?? "",
    ] as const,
  arAging: (businessId?: string | null) =>
    [...accountingKeys.all, "arAging", businessId ?? null] as const,
  apAging: (businessId?: string | null) =>
    [...accountingKeys.all, "apAging", businessId ?? null] as const,
};

/** Settings (staff). */
export const settingsKeys = {
  all: ["settings"] as const,
  billing: (ownerId?: string | null) =>
    [...settingsKeys.all, "billing", ownerId ?? null] as const,
  businesses: (ownerId?: string | null) =>
    [...settingsKeys.all, "businesses", ownerId ?? null] as const,
  roleSettings: (businessId?: string | null) =>
    [...settingsKeys.all, "roleSettings", businessId ?? null] as const,
  profile: () => [...settingsKeys.all, "profile"] as const,
  notificationPrefs: () => [...settingsKeys.all, "notificationPrefs"] as const,
};
