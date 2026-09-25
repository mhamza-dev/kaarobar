import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  closeShift,
  createRegister,
  getCurrentShift,
  getShift,
  getShiftReconciliation,
  getXReport,
  listCashMovements,
  listRegisters,
  listShifts,
  openShift,
  recordCashMovement,
  updateRegister,
} from "@/services/registers";

import { useTenantKey } from "./keys";

export function useRegisters() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["registers", tenant],
    queryFn: listRegisters,
  });
}

/**
 * The register's open shift, or `null` when none is open.
 *
 * `null` is a normal state, not an error: a till before opening time has no
 * shift, and the POS screen renders an "open the drawer" prompt from it.
 */
export function useCurrentShift(registerId: string | undefined) {
  return useQuery({
    queryKey: ["current-shift", registerId],
    queryFn: () => getCurrentShift(registerId!),
    enabled: !!registerId,
  });
}

export function useShifts(params: { register_id?: string } = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["shifts", tenant, params],
    queryFn: () => listShifts(params),
  });
}

export function useShift(id: string | undefined) {
  return useQuery({
    queryKey: ["shift", id],
    queryFn: () => getShift(id!),
    enabled: !!id,
  });
}

export function useXReport(shiftId: string | undefined) {
  return useQuery({
    queryKey: ["x-report", shiftId],
    queryFn: () => getXReport(shiftId!),
    enabled: !!shiftId,
  });
}

/** Recomputes the shift's figures from its sales — asked for, not loaded by default. */
export function useShiftReconciliation(shiftId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["shift-reconciliation", shiftId],
    queryFn: () => getShiftReconciliation(shiftId!),
    enabled: !!shiftId && enabled,
  });
}

export function useCashMovements(shiftId: string | undefined) {
  return useQuery({
    queryKey: ["cash-movements", shiftId],
    queryFn: () => listCashMovements(shiftId!),
    enabled: !!shiftId,
  });
}

/**
 * Anything touching a shift invalidates the shift, the register's current
 * shift and the drawer's movements together — they are three views of the
 * same drawer, and a stale one is a cashier counting against the wrong
 * expected figure.
 */
function useShiftMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      for (const key of ["shifts", "registers"]) {
        queryClient.invalidateQueries({ queryKey: [key, tenant] });
      }
      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
      queryClient.invalidateQueries({ queryKey: ["shift"] });
      queryClient.invalidateQueries({ queryKey: ["x-report"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
      queryClient.invalidateQueries({ queryKey: ["shift-reconciliation"] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useOpenShift() {
  return useShiftMutation<[string, { opening_float: string; notes?: string }], unknown>(openShift);
}

export function useCloseShift() {
  return useShiftMutation<
    [string, { declared_cash: string; declared_tenders?: Record<string, string>; notes?: string }],
    unknown
  >(closeShift);
}

export function useRecordCashMovement() {
  return useShiftMutation<
    [string, { kind: string; amount: string; reason?: string; note?: string }],
    unknown
  >(recordCashMovement);
}

export function useCreateRegister() {
  return useShiftMutation<[{ name: string; branch_id?: string; invoice_prefix?: string }], unknown>(
    createRegister,
  );
}

export function useUpdateRegister() {
  return useShiftMutation<
    [string, { name?: string; invoice_prefix?: string; is_active?: boolean }],
    unknown
  >(updateRegister);
}
