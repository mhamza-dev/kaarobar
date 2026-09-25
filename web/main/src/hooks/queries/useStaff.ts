import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  deleteStaffGrant,
  getStaff,
  listStaff,
  putStaffGrant,
  removeStaff,
  setStaffPin,
  setStaffBranches,
  setStaffRoles,
  setStaffStatus,
  updateStaff,
} from "@/services/staff";

import { useTenantKey } from "./keys";

export function useStaffList() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["staff", tenant],
    queryFn: listStaff,
  });
}

/**
 * Every staff mutation invalidates the same list and reports failures
 * through one toast helper — the shape each later domain copies.
 *
 * `onError` lives here rather than in each dialog so a screen only has to
 * handle its own success path (close the dialog, show a message); an
 * unhandled backend failure can never pass silently.
 */
function useStaffMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", tenant] });
      queryClient.invalidateQueries({ queryKey: ["staff-member"] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

/** One staff member — unlike the list, this carries their permission overrides. */
export function useStaffMember(id: string | null | undefined) {
  return useQuery({
    queryKey: ["staff-member", id],
    queryFn: () => getStaff(id!),
    enabled: !!id,
  });
}

export function useSetStaffPin() {
  return useStaffMutation(setStaffPin);
}

export function usePutStaffGrant() {
  return useStaffMutation(putStaffGrant);
}

export function useDeleteStaffGrant() {
  return useStaffMutation(deleteStaffGrant);
}

export function useUpdateStaff() {
  return useStaffMutation(updateStaff);
}

export function useSetStaffRoles() {
  return useStaffMutation(setStaffRoles);
}

export function useSetStaffBranches() {
  return useStaffMutation(setStaffBranches);
}

export function useSetStaffStatus() {
  return useStaffMutation(setStaffStatus);
}

export function useRemoveStaff() {
  return useStaffMutation(removeStaff);
}
