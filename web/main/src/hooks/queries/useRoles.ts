import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  createRole,
  deleteRole,
  getPermissionCatalogue,
  listRoles,
  updateRole,
} from "@/services/roles";
import type { RolePayload } from "@/types/api/staffing";

import { useTenantKey } from "./keys";

export function useRolesList() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["roles", tenant],
    queryFn: listRoles,
  });
}

/**
 * The ~140-key permission catalogue. Cached forever: it is compiled into
 * the backend (`AccessControl.Permissions`), so it cannot change without a
 * deploy, and the role editor would otherwise re-fetch it on every open.
 */
export function usePermissionCatalogue() {
  return useQuery({
    queryKey: ["permission-catalogue"],
    queryFn: getPermissionCatalogue,
    staleTime: Infinity,
  });
}

function useRoleMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", tenant] });
      // A role's permissions feed the current user's own resolved scope, so
      // re-bootstrap `/me`: editing your own role must change your nav now,
      // not at the next full reload.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateRole() {
  return useRoleMutation<[RolePayload], unknown>(createRole);
}

export function useUpdateRole() {
  return useRoleMutation<[string, Partial<RolePayload>], unknown>(updateRole);
}

export function useDeleteRole() {
  return useRoleMutation<[string], unknown>(deleteRole);
}
