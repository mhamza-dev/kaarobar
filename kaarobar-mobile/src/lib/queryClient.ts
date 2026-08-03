import { QueryClient } from "@tanstack/react-query";

/** Default QueryClient for staff mobile. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 45_000,
        retry: 1,
        refetchOnWindowFocus: true,
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
