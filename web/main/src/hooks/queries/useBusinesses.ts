import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { getBusiness, listBusinesses, updateBusiness } from "@/services/businesses";
import type { Business } from "@/types/api/tenancy";

import { useTenantKey } from "./keys";

export function useBusinessesList() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["businesses", tenant],
    queryFn: listBusinesses,
  });
}

export function useBusiness(id: string | undefined) {
  return useQuery({
    queryKey: ["business", id],
    queryFn: () => getBusiness(id!),
    enabled: !!id,
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: { id: string; payload: Partial<Business> }) =>
      updateBusiness(variables.id, variables.payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["businesses", tenant] });
      queryClient.invalidateQueries({ queryKey: ["business", variables.id] });
      // brand_color lives on the business and drives the runtime theme, so
      // re-bootstrap `/me` to repaint the shell straight after a save.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast.mutationError(error),
  });
}
