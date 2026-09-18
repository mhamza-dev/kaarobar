import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { getOrganization, updateOrganization } from "@/services/organization";
import type { Organization } from "@/types/api/tenancy";

import { useTenantKey } from "./keys";

export function useOrganization() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["organization", tenant],
    queryFn: getOrganization,
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (payload: Partial<Organization>) => updateOrganization(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", tenant] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast.mutationError(error),
  });
}
