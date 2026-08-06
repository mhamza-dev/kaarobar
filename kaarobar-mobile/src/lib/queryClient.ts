import { QueryClient } from "@tanstack/react-query";

const CACHE_STALE_TIME_MS = 45_000;
const CACHE_GC_TIME_MS = 10 * 60_000;

/** Default QueryClient for staff mobile. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_STALE_TIME_MS,
        gcTime: CACHE_GC_TIME_MS,
        retry: 1,
        networkMode: "offlineFirst",
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 1,
        networkMode: "offlineFirst",
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

/** Customers / AR (staff). */
export const customerKeys = {
  all: ["customers"] as const,
  list: (businessId?: string | null) =>
    [...customerKeys.all, "list", businessId ?? null] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
};

/** Sales history (staff). */
export const salesKeys = {
  all: ["sales"] as const,
  list: (businessId?: string | null, branchId?: string | null, params?: string) =>
    [...salesKeys.all, "list", businessId ?? null, branchId ?? null, params ?? ""] as const,
  detail: (id: string) => [...salesKeys.all, "detail", id] as const,
};

/** POS till / catalog (staff). */
export const posKeys = {
  all: ["pos"] as const,
  products: (businessId?: string | null, branchId?: string | null, page?: number) =>
    [...posKeys.all, "products", businessId ?? null, branchId ?? null, page ?? 0] as const,
  till: (branchId?: string | null) =>
    [...posKeys.all, "till", branchId ?? null] as const,
};

