import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api/errors";
import { flattenPages, getNextCursorParam } from "@/lib/api/pagination";
import {
  addCustomerAddress,
  addCustomerContact,
  addCustomerNote,
  adjustLoyaltyPoints,
  archiveCustomer,
  cancelFollowUp,
  completeFollowUp,
  createCustomer,
  createCustomerGroup,
  createFollowUp,
  createLoyaltyProgram,
  deleteCustomerAddress,
  deleteCustomerContact,
  deleteCustomerGroup,
  deleteCustomerNote,
  getAgeingByCustomer,
  getCreditAgeing,
  getCustomer,
  getCustomerLedger,
  getLoyaltyHistory,
  getLoyaltyProgram,
  listCustomerAddresses,
  listCustomerContacts,
  listCustomerGroups,
  listCustomerNotes,
  listCustomerPayments,
  listCustomers,
  listFollowUps,
  listOpenInvoices,
  listStoreCredit,
  recordCustomerPayment,
  updateCustomer,
  updateCustomerAddress,
  updateCustomerGroup,
  updateLoyaltyProgram,
  type RecordCustomerPaymentPayload,
} from "@/services/customers";
import type {
  CustomerAddress,
  CustomerContact,
  CustomerGroup,
  CustomerListParams,
  CustomerPayload,
  LoyaltyProgram,
} from "@/types/api/crm";

import { useTenantKey } from "./keys";

/**
 * Everything a customer-side write can move.
 *
 * A payment changes the balance on the list row, the ledger, the open
 * invoices and every ageing figure at once; a follow-up shows on the
 * customer page and on the global list. Invalidating the whole CRM surface
 * together is cheaper than being wrong about which of those moved.
 */
const CRM_KEYS = [
  "customers",
  "customer",
  "customer-groups",
  "credit",
  "follow-ups",
  "loyalty",
] as const;

function useCrmMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      for (const key of CRM_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

/** A 404 here means "none yet" (no programme, never earned) — not worth retrying. */
function retryUnlessNotFound(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status === 404) return false;
  return failureCount < 2;
}

// --- Customers --------------------------------------------------------------

export function useCustomers(params: CustomerListParams = {}) {
  const tenant = useTenantKey();

  const query = useInfiniteQuery({
    queryKey: ["customers", tenant, params],
    queryFn: ({ pageParam }) => listCustomers({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorParam,
  });

  return { ...query, rows: flattenPages(query.data?.pages) };
}

/**
 * A short, server-side search for pickers (the till, a follow-up form).
 *
 * One page is enough: a picker that needs scrolling through fifty
 * "Ahmed"s wants a better query, not a longer list.
 */
export function useCustomerSearch(q: string, enabled = true) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["customers", tenant, "search", q],
    queryFn: async () => (await listCustomers({ q: q || undefined, limit: 8 })).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  return useCrmMutation<[CustomerPayload], unknown>(createCustomer);
}

export function useUpdateCustomer() {
  return useCrmMutation<[string, Partial<CustomerPayload>], unknown>(updateCustomer);
}

export function useArchiveCustomer() {
  return useCrmMutation<[string], unknown>(archiveCustomer);
}

// --- Account ----------------------------------------------------------------

export function useCustomerLedger(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["customer", id, "ledger"],
    queryFn: () => getCustomerLedger(id!),
    enabled: !!id && enabled,
  });
}

export function useCustomerPayments(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["customer", id, "payments"],
    queryFn: () => listCustomerPayments(id!),
    enabled: !!id && enabled,
  });
}

export function useOpenInvoices(customerId: string | undefined, enabled = true) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["credit", tenant, "invoices", customerId],
    queryFn: () => listOpenInvoices({ customer_id: customerId }),
    enabled,
  });
}

export function useStoreCredit(customerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["customer", customerId, "store-credit"],
    queryFn: () => listStoreCredit(customerId!),
    enabled: !!customerId && enabled,
  });
}

export function useRecordCustomerPayment() {
  return useCrmMutation<[string, RecordCustomerPaymentPayload], unknown>(recordCustomerPayment);
}

// --- Addresses, contacts, notes --------------------------------------------

export function useCustomerAddresses(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer", customerId, "addresses"],
    queryFn: () => listCustomerAddresses(customerId!),
    enabled: !!customerId,
  });
}

export function useAddCustomerAddress() {
  return useCrmMutation<[string, Partial<CustomerAddress>], unknown>(addCustomerAddress);
}

export function useUpdateCustomerAddress() {
  return useCrmMutation<[string, Partial<CustomerAddress>], unknown>(updateCustomerAddress);
}

export function useDeleteCustomerAddress() {
  return useCrmMutation<[string], unknown>(deleteCustomerAddress);
}

export function useCustomerContacts(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer", customerId, "contacts"],
    queryFn: () => listCustomerContacts(customerId!),
    enabled: !!customerId,
  });
}

export function useAddCustomerContact() {
  return useCrmMutation<[string, Partial<CustomerContact>], unknown>(addCustomerContact);
}

export function useDeleteCustomerContact() {
  return useCrmMutation<[string], unknown>(deleteCustomerContact);
}

export function useCustomerNotes(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer", customerId, "notes"],
    queryFn: () => listCustomerNotes(customerId!),
    enabled: !!customerId,
  });
}

export function useAddCustomerNote() {
  return useCrmMutation<[string, { body: string; is_pinned?: boolean }], unknown>(addCustomerNote);
}

export function useDeleteCustomerNote() {
  return useCrmMutation<[string], unknown>(deleteCustomerNote);
}

// --- Groups -----------------------------------------------------------------

export function useCustomerGroups(enabled = true) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["customer-groups", tenant],
    queryFn: listCustomerGroups,
    enabled,
  });
}

export function useCreateCustomerGroup() {
  return useCrmMutation<[Partial<CustomerGroup>], unknown>(createCustomerGroup);
}

export function useUpdateCustomerGroup() {
  return useCrmMutation<[string, Partial<CustomerGroup>], unknown>(updateCustomerGroup);
}

export function useDeleteCustomerGroup() {
  return useCrmMutation<[string], unknown>(deleteCustomerGroup);
}

// --- Receivables ------------------------------------------------------------

export function useCreditAgeing(asOf?: string) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["credit", tenant, "ageing", asOf],
    queryFn: () => getCreditAgeing({ as_of: asOf }),
  });
}

export function useAgeingByCustomer(asOf?: string) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["credit", tenant, "ageing-by-customer", asOf],
    queryFn: () => getAgeingByCustomer({ as_of: asOf }),
  });
}

// --- Follow-ups -------------------------------------------------------------

export function useFollowUps(
  params: { status?: string; customer_id?: string; due_before?: string } = {},
  enabled = true,
) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["follow-ups", tenant, params],
    queryFn: () => listFollowUps(params),
    enabled,
  });
}

export function useCreateFollowUp() {
  return useCrmMutation<
    [string, { title: string; kind?: string; due_on: string; body?: string }],
    unknown
  >(createFollowUp);
}

export function useCompleteFollowUp() {
  return useCrmMutation<[string, string], unknown>(completeFollowUp);
}

export function useCancelFollowUp() {
  return useCrmMutation<[string, string?], unknown>(cancelFollowUp);
}

// --- Loyalty ----------------------------------------------------------------

export function useLoyaltyProgram(enabled = true) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["loyalty", tenant, "program"],
    queryFn: getLoyaltyProgram,
    retry: retryUnlessNotFound,
    enabled,
  });
}

export function useSaveLoyaltyProgram(exists: boolean) {
  return useCrmMutation<[Partial<LoyaltyProgram>], unknown>(
    exists ? updateLoyaltyProgram : createLoyaltyProgram,
  );
}

export function useLoyaltyHistory(customerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["loyalty", "customer", customerId],
    queryFn: () => getLoyaltyHistory(customerId!),
    retry: retryUnlessNotFound,
    enabled: !!customerId && enabled,
  });
}

export function useAdjustLoyaltyPoints() {
  return useCrmMutation<[string, { points: number; reason: string }], unknown>(adjustLoyaltyPoints);
}
