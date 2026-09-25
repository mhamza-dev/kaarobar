import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { CashMovement, Register, Shift, ShiftReconciliation } from "@/types/api/sales";

export async function listRegisters(): Promise<Register[]> {
  const response = await apiClient.get<ApiEnvelope<Register[]>>("/registers");
  return response.data.data;
}

export async function createRegister(payload: {
  name: string;
  branch_id?: string;
  invoice_prefix?: string;
}): Promise<Register> {
  const response = await apiClient.post<ApiEnvelope<Register>>("/registers", payload);
  return response.data.data;
}

export async function updateRegister(
  id: string,
  payload: { name?: string; invoice_prefix?: string; is_active?: boolean },
): Promise<Register> {
  const response = await apiClient.patch<ApiEnvelope<Register>>(`/registers/${id}`, payload);
  return response.data.data;
}

/**
 * `GET /registers/:id/shift` — the register's open shift, if any.
 *
 * A 404 here is the normal "no shift open yet" case, not a failure; the
 * caller treats it as `null` rather than an error state.
 */
export async function getCurrentShift(registerId: string): Promise<Shift | null> {
  try {
    const response = await apiClient.get<ApiEnvelope<Shift>>(`/registers/${registerId}/shift`);
    return response.data.data;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

export async function openShift(
  registerId: string,
  payload: { opening_float: string; notes?: string },
): Promise<Shift> {
  const response = await apiClient.post<ApiEnvelope<Shift>>(
    `/registers/${registerId}/shift`,
    payload,
  );
  return response.data.data;
}

export async function listShifts(params: { register_id?: string } = {}): Promise<Shift[]> {
  const response = await apiClient.get<ApiEnvelope<Shift[]>>("/shifts", { params });
  return response.data.data;
}

export async function getShift(id: string): Promise<Shift> {
  const response = await apiClient.get<ApiEnvelope<Shift>>(`/shifts/${id}`);
  return response.data.data;
}

/**
 * Closing a shift requires the cash actually counted in the drawer
 * (`declared_cash`) — the backend computes the variance against what it
 * expected, which is the entire point of closing.
 */
export async function closeShift(
  id: string,
  payload: { declared_cash: string; declared_tenders?: Record<string, string>; notes?: string },
): Promise<Shift> {
  const response = await apiClient.post<ApiEnvelope<Shift>>(`/shifts/${id}/close`, payload);
  return response.data.data;
}

export async function listCashMovements(shiftId: string): Promise<CashMovement[]> {
  const response = await apiClient.get<ApiEnvelope<CashMovement[]>>(
    `/shifts/${shiftId}/cash-movements`,
  );
  return response.data.data;
}

export async function recordCashMovement(
  shiftId: string,
  payload: { kind: string; amount: string; reason?: string; note?: string },
): Promise<CashMovement> {
  const response = await apiClient.post<ApiEnvelope<CashMovement>>(
    `/shifts/${shiftId}/cash-movements`,
    payload,
  );
  return response.data.data;
}

/** The shift's running totals against the same figures recomputed from its sales. */
export async function getShiftReconciliation(id: string): Promise<ShiftReconciliation> {
  const response = await apiClient.get<ApiEnvelope<ShiftReconciliation>>(
    `/shifts/${id}/reconcile`,
  );
  return response.data.data;
}

/** The X-report: what the drawer should hold right now, without closing. */
export async function getXReport(shiftId: string): Promise<{
  shift: Shift;
  expected_cash: string;
  net_sales: string;
  cash_movements: CashMovement[];
}> {
  const response = await apiClient.get<
    ApiEnvelope<{
      shift: Shift;
      expected_cash: string;
      net_sales: string;
      cash_movements: CashMovement[];
    }>
  >(`/shifts/${shiftId}/x-report`);
  return response.data.data;
}
