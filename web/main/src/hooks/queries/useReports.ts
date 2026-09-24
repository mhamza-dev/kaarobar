import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";

import { getProduct } from "@/services/products";
import {
  getByBranch,
  getByCashier,
  getByCategory,
  getByHour,
  getByTender,
  getDaily,
  getProfit,
  getSalesSummary,
  getTaxReport,
  getTopProducts,
} from "@/services/reports";
import type { ReportPeriod } from "@/types/api/reports";

import { useTenantKey } from "./keys";

/**
 * One query per report, keyed by tenant, report name and period. Reports
 * are read-only aggregates — a minute of staleness costs nothing and saves
 * re-querying every tab switch.
 */
function useReport<T>(
  name: string,
  period: ReportPeriod,
  fetcher: (p: ReportPeriod) => Promise<T>,
  enabled = true,
) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["reports", tenant, name, period],
    queryFn: () => fetcher(period),
    staleTime: 60_000,
    // Changing the period keeps the previous figures on screen until the
    // new ones land, rather than flashing every chart back to a skeleton.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const useSalesSummary = (period: ReportPeriod, enabled = true) =>
  useReport("summary", period, getSalesSummary, enabled);
export const useDailySales = (period: ReportPeriod, enabled = true) =>
  useReport("daily", period, getDaily, enabled);
export const useTopProducts = (period: ReportPeriod, enabled = true) =>
  useReport("top-products", period, (p) => getTopProducts({ ...p, limit: 20 }), enabled);
export const useSalesByCategory = (period: ReportPeriod, enabled = true) =>
  useReport("by-category", period, getByCategory, enabled);
export const useSalesByTender = (period: ReportPeriod, enabled = true) =>
  useReport("by-tender", period, getByTender, enabled);
export const useSalesByCashier = (period: ReportPeriod, enabled = true) =>
  useReport("by-cashier", period, getByCashier, enabled);
export const useSalesByBranch = (period: ReportPeriod, enabled = true) =>
  useReport("by-branch", period, getByBranch, enabled);
export const useSalesByHour = (period: ReportPeriod, enabled = true) =>
  useReport("by-hour", period, getByHour, enabled);
export const useProfitAndLoss = (period: ReportPeriod, enabled = true) =>
  useReport("profit", period, getProfit, enabled);
export const useTaxReport = (period: ReportPeriod, enabled = true) =>
  useReport("tax", period, getTaxReport, enabled);

/**
 * Names for the product ids a report returns. Report rows carry ids only;
 * a top-products list is short (the backend caps it), so resolving each
 * through the cached product query is cheap and reuses what the catalog
 * screens already fetched.
 */
export function useProductNames(ids: string[]): Record<string, string> {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["product", id],
      queryFn: () => getProduct(id),
      staleTime: 5 * 60_000,
    })),
  });

  return Object.fromEntries(
    results.flatMap((result, index) => (result.data ? [[ids[index], result.data.name]] : [])),
  );
}
