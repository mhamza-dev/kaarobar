import { QueryClient } from "@tanstack/react-query";

/** Default QueryClient for buyer (customer) mobile. */
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

/** Customer portal (buyer). */
export const portalKeys = {
  all: ["portal"] as const,
  orders: () => [...portalKeys.all, "orders"] as const,
  order: (id: string) => [...portalKeys.all, "orders", id] as const,
  appointments: () => [...portalKeys.all, "appointments"] as const,
  appointment: (id: string) => [...portalKeys.all, "appointments", id] as const,
  appointmentSlots: (params: Record<string, string>) =>
    [...portalKeys.all, "appointmentSlots", params] as const,
  loyalty: () => [...portalKeys.all, "loyalty"] as const,
  ar: () => [...portalKeys.all, "ar"] as const,
};

/** Marketplace / Discover (buyer). */
export const marketplaceKeys = {
  all: ["marketplace"] as const,
  products: (filters: Record<string, unknown>) =>
    [...marketplaceKeys.all, "products", filters] as const,
  businesses: (filters?: Record<string, unknown>) =>
    [...marketplaceKeys.all, "businesses", filters ?? {}] as const,
  catalog: (storeKey: string) =>
    [...marketplaceKeys.all, "catalog", storeKey] as const,
  product: (storeKey: string, productId: string) =>
    [...marketplaceKeys.all, "product", storeKey, productId] as const,
};
