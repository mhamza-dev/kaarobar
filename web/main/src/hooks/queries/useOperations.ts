import { useQuery } from "@tanstack/react-query";

import {
  approveCommissions,
  assignDelivery,
  cancelDelivery,
  completeDelivery,
  createCommissionRule,
  createDelivery,
  deleteCommissionRule,
  deleteTimeEntry,
  failDelivery,
  getCommissionStatement,
  getCommissionSummary,
  getDelivery,
  getRiderBoard,
  getUnbilledTime,
  getUtilisation,
  listCommissionRules,
  listDeliveries,
  listOpenOrders,
  listTimeEntries,
  logTime,
  payCommissions,
  pickUpDelivery,
  updateCommissionRule,
} from "@/services/operations";
import type {
  CommissionRulePayload,
  DeliveryPayload,
  TimeEntryPayload,
} from "@/types/api/operations";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

const DELIVERY_KEYS = ["deliveries", "delivery", "rider-board"];

export function useDeliveries(params: { status?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["deliveries", tenant, params],
    queryFn: () => listDeliveries(params),
    // A board people watch: keep it current without a reload.
    refetchInterval: 30_000,
  });
}
export function useDelivery(id: string | null | undefined) {
  return useQuery({ queryKey: ["delivery", id], queryFn: () => getDelivery(id!), enabled: !!id });
}
export function useRiderBoard() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["rider-board", tenant],
    queryFn: getRiderBoard,
    refetchInterval: 30_000,
  });
}
export function useOpenOrders(enabled: boolean) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["orders", tenant, "open"], queryFn: listOpenOrders, enabled });
}
export const useCreateDelivery = () =>
  useInvalidatingMutation<[DeliveryPayload], unknown>(createDelivery, DELIVERY_KEYS);
export const useAssignDelivery = () =>
  useInvalidatingMutation<[string, string], unknown>(assignDelivery, DELIVERY_KEYS);
export const usePickUpDelivery = () =>
  useInvalidatingMutation<[string], unknown>(pickUpDelivery, DELIVERY_KEYS);
export const useCompleteDelivery = () =>
  useInvalidatingMutation<[string, string?], unknown>(completeDelivery, DELIVERY_KEYS);
export const useFailDelivery = () =>
  useInvalidatingMutation<[string, string], unknown>(failDelivery, DELIVERY_KEYS);
export const useCancelDelivery = () =>
  useInvalidatingMutation<[string], unknown>(cancelDelivery, DELIVERY_KEYS);

const COMMISSION_KEYS = ["commission-rules", "commission-summary", "commission-statement"];

export function useCommissionRules() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["commission-rules", tenant], queryFn: listCommissionRules });
}
export function useCommissionSummary(from: string, to: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["commission-summary", tenant, from, to],
    queryFn: () => getCommissionSummary(from, to),
    enabled: !!from && !!to,
  });
}
export function useCommissionStatement(userId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ["commission-statement", userId, from, to],
    queryFn: () => getCommissionStatement(userId!, from, to),
    enabled: !!userId && !!from && !!to,
  });
}
export const useCreateCommissionRule = () =>
  useInvalidatingMutation<[CommissionRulePayload], unknown>(createCommissionRule, COMMISSION_KEYS);
export const useUpdateCommissionRule = () =>
  useInvalidatingMutation<[string, Partial<CommissionRulePayload>], unknown>(
    updateCommissionRule,
    COMMISSION_KEYS,
  );
export const useDeleteCommissionRule = () =>
  useInvalidatingMutation<[string], unknown>(deleteCommissionRule, COMMISSION_KEYS);
export const useApproveCommissions = () =>
  useInvalidatingMutation<[string[]], unknown>(approveCommissions, COMMISSION_KEYS);
export const usePayCommissions = () =>
  useInvalidatingMutation<[string[]], unknown>(payCommissions, COMMISSION_KEYS);

const TIME_KEYS = ["time-entries", "time-unbilled", "time-utilisation"];

export function useTimeEntries(params: { from?: string; to?: string; user_id?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["time-entries", tenant, params],
    queryFn: () => listTimeEntries(params),
  });
}
export function useUnbilledTime() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["time-unbilled", tenant], queryFn: getUnbilledTime });
}
export function useUtilisation(from: string, to: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["time-utilisation", tenant, from, to],
    queryFn: () => getUtilisation(from, to),
    enabled: !!from && !!to,
  });
}
export const useLogTime = () =>
  useInvalidatingMutation<[TimeEntryPayload], unknown>(logTime, TIME_KEYS);
export const useDeleteTimeEntry = () =>
  useInvalidatingMutation<[string], unknown>(deleteTimeEntry, TIME_KEYS);
