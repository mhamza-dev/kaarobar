import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  createBranch,
  deleteBranch,
  listBranches,
  setMainBranch,
  updateBranch,
} from "@/services/branches";
import type { Branch } from "@/types/api/tenancy";

import { useTenantKey } from "./keys";

export function useBranchesList() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["branches", tenant],
    queryFn: listBranches,
  });
}

function useBranchMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches", tenant] });
      // `/me` carries the caller's branch and branch_ids.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateBranch() {
  return useBranchMutation<[Partial<Branch>], unknown>(createBranch);
}

export function useUpdateBranch() {
  return useBranchMutation<[string, Partial<Branch>], unknown>(updateBranch);
}

export function useDeleteBranch() {
  return useBranchMutation<[string], unknown>(deleteBranch);
}

export function useSetMainBranch() {
  return useBranchMutation<[string], unknown>(setMainBranch);
}
