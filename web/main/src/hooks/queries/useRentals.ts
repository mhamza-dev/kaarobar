import { useQuery } from "@tanstack/react-query";

import {
  bookRental,
  cancelRental,
  createRentalUnit,
  getRental,
  issueRental,
  listAvailableUnits,
  listRentalUnits,
  listRentals,
  returnRental,
  updateRentalUnit,
} from "@/services/rentals";
import type { RentalAgreement, RentalUnit } from "@/types/api/rentals";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

const RENTAL_KEYS = ["rentals", "rental", "rental-units", "rental-availability"];

export function useRentalUnits(params: { status?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["rental-units", tenant, params],
    queryFn: () => listRentalUnits(params),
  });
}

export function useAvailableUnits(from: string, to: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["rental-availability", tenant, from, to],
    queryFn: () => listAvailableUnits(from, to),
    enabled: !!from && !!to && from < to,
  });
}

export function useRentals(params: { status?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["rentals", tenant, params], queryFn: () => listRentals(params) });
}

export function useRental(id: string | undefined) {
  return useQuery({ queryKey: ["rental", id], queryFn: () => getRental(id!), enabled: !!id });
}

export const useCreateRentalUnit = () =>
  useInvalidatingMutation<[Partial<RentalUnit>], unknown>(createRentalUnit, RENTAL_KEYS);
export const useUpdateRentalUnit = () =>
  useInvalidatingMutation<[string, Partial<RentalUnit>], unknown>(updateRentalUnit, RENTAL_KEYS);
export const useBookRental = () =>
  useInvalidatingMutation<[Parameters<typeof bookRental>[0]], RentalAgreement>(
    bookRental,
    RENTAL_KEYS,
  );
export const useIssueRental = () =>
  useInvalidatingMutation<[string], unknown>(issueRental, RENTAL_KEYS);
export const useReturnRental = () =>
  useInvalidatingMutation<[string, Parameters<typeof returnRental>[1]], unknown>(
    returnRental,
    RENTAL_KEYS,
  );
export const useCancelRental = () =>
  useInvalidatingMutation<[string, string?], unknown>(cancelRental, RENTAL_KEYS);
