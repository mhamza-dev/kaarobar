import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/services/categories";
import type { CategoryPayload } from "@/types/api/catalog";

import { useTenantKey } from "./keys";

export function useCategoriesList() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["categories", tenant],
    queryFn: listCategories,
  });
}

function useCategoryMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", tenant] });
      // Products carry their category inline.
      queryClient.invalidateQueries({ queryKey: ["products", tenant] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateCategory() {
  return useCategoryMutation<[CategoryPayload], unknown>(createCategory);
}

export function useUpdateCategory() {
  return useCategoryMutation<[string, Partial<CategoryPayload>], unknown>(updateCategory);
}

export function useDeleteCategory() {
  return useCategoryMutation<[string], unknown>(deleteCategory);
}
