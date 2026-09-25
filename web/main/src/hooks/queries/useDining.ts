import { useQuery } from "@tanstack/react-query";

import {
  addOrderItems,
  advanceTicket,
  closeSession,
  createFloor,
  createStation,
  createTable,
  deleteStation,
  deleteTable,
  fireOrder,
  getFloorPlan,
  getKitchenBoard,
  getOrder,
  getSession,
  listFloors,
  listStations,
  listTables,
  markSessionBilled,
  mergeSession,
  removeOrderItem,
  seatTable,
  transferSession,
  updateStation,
  updateTable,
  type TicketAction,
} from "@/services/dining";
import type { DiningTable, Floor, KitchenStation } from "@/types/api/dining";
import type { OrderItemInput } from "@/types/api/orders";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

const FLOOR_KEYS = ["floor-plan", "dining-tables", "dining-floors", "table-session", "order"];
const KITCHEN_KEYS = ["kitchen-board", "order", "table-session"];

export function useFloorPlan() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["floor-plan", tenant],
    queryFn: getFloorPlan,
    // "Seated 40 min" goes stale on its own; a host stand wants it fresh.
    refetchInterval: 60_000,
  });
}

export function useFloors() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["dining-floors", tenant], queryFn: listFloors });
}

export function useDiningTables() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["dining-tables", tenant], queryFn: listTables });
}

export const useCreateFloor = () =>
  useInvalidatingMutation<[Partial<Floor>], unknown>(createFloor, FLOOR_KEYS);
export const useCreateTable = () =>
  useInvalidatingMutation<[Partial<DiningTable>], unknown>(createTable, FLOOR_KEYS);
export const useUpdateTable = () =>
  useInvalidatingMutation<[string, Partial<DiningTable>], unknown>(updateTable, FLOOR_KEYS);
export const useDeleteTable = () =>
  useInvalidatingMutation<[string], unknown>(deleteTable, FLOOR_KEYS);

export function useTableSession(id: string | undefined) {
  return useQuery({
    queryKey: ["table-session", id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });
}

export function useOrder(id: string | null | undefined) {
  return useQuery({ queryKey: ["order", id], queryFn: () => getOrder(id!), enabled: !!id });
}

export const useSeatTable = () =>
  useInvalidatingMutation<[Parameters<typeof seatTable>[0]], Awaited<ReturnType<typeof seatTable>>>(
    seatTable,
    FLOOR_KEYS,
  );
export const useTransferSession = () =>
  useInvalidatingMutation<[string, string], unknown>(transferSession, FLOOR_KEYS);
export const useMergeSession = () =>
  useInvalidatingMutation<[string, string], unknown>(mergeSession, FLOOR_KEYS);
export const useMarkSessionBilled = () =>
  useInvalidatingMutation<[string], unknown>(markSessionBilled, FLOOR_KEYS);
export const useCloseSession = () =>
  useInvalidatingMutation<[string], unknown>(closeSession, FLOOR_KEYS);

export const useAddOrderItems = () =>
  useInvalidatingMutation<[string, OrderItemInput[]], unknown>(addOrderItems, FLOOR_KEYS);
export const useRemoveOrderItem = () =>
  useInvalidatingMutation<[string, string], unknown>(removeOrderItem, FLOOR_KEYS);

// --- Kitchen --------------------------------------------------------------------

/**
 * The kitchen board.
 *
 * Kept live by the `kds:<branch>` channel (see `useKitchenChannel`), which
 * invalidates this query on every `board_changed`. The slow poll is the
 * fallback for a socket that dropped without anyone noticing — a kitchen
 * screen that silently stops updating is the failure worth guarding.
 */
export function useKitchenBoard(stationId?: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["kitchen-board", tenant, stationId],
    queryFn: () => getKitchenBoard({ station_id: stationId }),
    refetchInterval: 30_000,
  });
}

export function useStations() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["kitchen-stations", tenant], queryFn: listStations });
}

const STATION_KEYS = ["kitchen-stations", "kitchen-board"];
export const useCreateStation = () =>
  useInvalidatingMutation<[Partial<KitchenStation>], unknown>(createStation, STATION_KEYS);
export const useUpdateStation = () =>
  useInvalidatingMutation<[string, Partial<KitchenStation>], unknown>(updateStation, STATION_KEYS);
export const useDeleteStation = () =>
  useInvalidatingMutation<[string], unknown>(deleteStation, STATION_KEYS);

export const useFireOrder = () =>
  useInvalidatingMutation<[Parameters<typeof fireOrder>[0]], unknown>(fireOrder, KITCHEN_KEYS);
export const useAdvanceTicket = () =>
  useInvalidatingMutation<[string, TicketAction], unknown>(advanceTicket, KITCHEN_KEYS);
