import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";
import {
  cancelSubscription,
  changePlan,
  getSubscription,
  listBillingInvoices,
  listPlans,
  resumeSubscription,
  subscribe,
} from "@/services/billing";
import {
  disableFiscal,
  getFiscalConfig,
  getFiscalStatus,
  listFiscalSubmissions,
  retryAllSubmissions,
  retrySubmission,
  saveFiscalConfig,
} from "@/services/fiscal";
import {
  createProvider,
  deleteProvider,
  listPaymentIntents,
  listProviders,
  listSettlements,
  reconcileSettlement,
  refundPaymentIntent,
  syncPaymentIntent,
  updateProvider,
} from "@/services/payments";
import type { FiscalConfigPayload } from "@/types/api/fiscal";
import type { PaymentProviderPayload } from "@/types/api/payments";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

// --- Payment providers and gateway payments -------------------------------------

const PAYMENT_KEYS = ["payment-providers", "payment-intents", "settlements"];

export function usePaymentProviders() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["payment-providers", tenant], queryFn: listProviders });
}

export const useCreateProvider = () =>
  useInvalidatingMutation<[PaymentProviderPayload], unknown>(createProvider, PAYMENT_KEYS);
export const useUpdateProvider = () =>
  useInvalidatingMutation<[string, PaymentProviderPayload], unknown>(updateProvider, PAYMENT_KEYS);
export const useDeleteProvider = () =>
  useInvalidatingMutation<[string], unknown>(deleteProvider, PAYMENT_KEYS);

export function usePaymentIntents(params: { status?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["payment-intents", tenant, params],
    queryFn: () => listPaymentIntents(params),
  });
}

export const useSyncPaymentIntent = () =>
  useInvalidatingMutation<[string], unknown>(syncPaymentIntent, PAYMENT_KEYS);
export const useRefundPaymentIntent = () =>
  useInvalidatingMutation<[string, string], unknown>(refundPaymentIntent, [
    ...PAYMENT_KEYS,
    "sales",
    "sale",
  ]);

export function useSettlements() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["settlements", tenant], queryFn: listSettlements });
}

export const useReconcileSettlement = () =>
  useInvalidatingMutation<[string, string?], unknown>(reconcileSettlement, PAYMENT_KEYS);

// --- Subscription (organization-level) ------------------------------------------

const BILLING_KEYS = ["billing-subscription", "billing-invoices", "me"];

export function usePlans() {
  return useQuery({ queryKey: ["billing-plans"], queryFn: listPlans, staleTime: 5 * 60_000 });
}

export function useSubscription() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["billing-subscription", tenant], queryFn: getSubscription });
}

export function useBillingInvoices() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["billing-invoices", tenant], queryFn: listBillingInvoices });
}

export const useSubscribe = () =>
  useInvalidatingMutation<[string, boolean?], unknown>(subscribe, BILLING_KEYS);
export const useChangePlan = () =>
  useInvalidatingMutation<[string], unknown>(changePlan, BILLING_KEYS);
export const useCancelSubscription = () =>
  useInvalidatingMutation<[boolean?], unknown>(cancelSubscription, BILLING_KEYS);
export const useResumeSubscription = () =>
  useInvalidatingMutation<[], unknown>(resumeSubscription, BILLING_KEYS);

// --- Fiscal -------------------------------------------------------------------------

const FISCAL_KEYS = ["fiscal-config", "fiscal-status", "fiscal-submissions"];

export function useFiscalConfig(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["fiscal-config", tenant],
    queryFn: getFiscalConfig,
    enabled,
    retry: (count, error) => !(error instanceof ApiError && error.status === 403) && count < 2,
  });
}

export function useFiscalStatus() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["fiscal-status", tenant], queryFn: getFiscalStatus });
}

export function useFiscalSubmissions(params: { status?: string; needs_attention?: boolean } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["fiscal-submissions", tenant, params],
    queryFn: () => listFiscalSubmissions(params),
  });
}

export const useSaveFiscalConfig = () =>
  useInvalidatingMutation<[FiscalConfigPayload], unknown>(saveFiscalConfig, FISCAL_KEYS);
export const useDisableFiscal = () =>
  useInvalidatingMutation<[], unknown>(disableFiscal, FISCAL_KEYS);
export const useRetrySubmission = () =>
  useInvalidatingMutation<[string], unknown>(retrySubmission, FISCAL_KEYS);
export const useRetryAllSubmissions = () =>
  useInvalidatingMutation<[], unknown>(retryAllSubmissions, FISCAL_KEYS);
