import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { flattenPages, getNextCursorParam } from "@/lib/api/pagination";
import {
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  getProduct,
  listProducts,
  listVariants,
  updateProduct,
  updateVariant,
} from "@/services/products";
import type { ProductListParams, ProductPayload, VariantPayload } from "@/types/api/catalog";

import { useTenantKey } from "./keys";

/**
 * The first cursor-paginated list in the app — the template every later
 * large-dataset screen copies.
 *
 * `params` is part of the query key, so changing a filter starts a fresh
 * cursor chain rather than appending the new filter's first page to the old
 * filter's rows.
 */
export function useProductsList(params: ProductListParams & { limit?: number } = {}) {
  const tenant = useTenantKey();

  const query = useInfiniteQuery({
    queryKey: ["products", tenant, params],
    queryFn: ({ pageParam }) => listProducts({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorParam,
  });

  return { ...query, rows: flattenPages(query.data?.pages) };
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct(id!),
    enabled: !!id,
  });
}

function useProductMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      // Every filter/cursor combination shares the ["products", tenant]
      // prefix, so one invalidation covers all of them.
      queryClient.invalidateQueries({ queryKey: ["products", tenant] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateProduct() {
  return useProductMutation<[ProductPayload], unknown>(createProduct);
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: { id: string; payload: ProductPayload }) =>
      updateProduct(variables.id, variables.payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products", tenant] });
      queryClient.invalidateQueries({ queryKey: ["product", variables.id] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useDeleteProduct() {
  return useProductMutation<[string], unknown>(deleteProduct);
}

export function useVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ["variants", productId],
    queryFn: () => listVariants(productId!),
    enabled: !!productId,
  });
}

function useVariantMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  productId: string | undefined,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variants", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      // A variant carries the sellable price, so the product list's summary
      // of it is stale too.
      queryClient.invalidateQueries({ queryKey: ["products", tenant] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateVariant(productId: string | undefined) {
  return useVariantMutation<[string, VariantPayload], unknown>(createVariant, productId);
}

export function useUpdateVariant(productId: string | undefined) {
  return useVariantMutation<[string, VariantPayload], unknown>(updateVariant, productId);
}

export function useDeleteVariant(productId: string | undefined) {
  return useVariantMutation<[string], unknown>(deleteVariant, productId);
}
