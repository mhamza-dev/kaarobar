import { useQuery } from "@tanstack/react-query";

import {
  addBarcode,
  addModifier,
  attachModifierGroup,
  createBrand,
  createModifierGroup,
  createOptionType,
  createOptionValue,
  createTax,
  createTaxGroup,
  createUnit,
  deleteBarcode,
  deleteBrand,
  deleteModifierGroup,
  deleteTax,
  deleteTaxGroup,
  detachModifierGroup,
  generateVariantMatrix,
  listBrands,
  listModifierGroups,
  listOptionTypes,
  listTaxes,
  listTaxGroups,
  listUnits,
  setDefaultTaxGroup,
  updateBrand,
  updateModifierGroup,
  updateTax,
  updateTaxGroup,
  type ModifierGroupPayload,
} from "@/services/catalogSetup";
import type { Brand, TaxGroupPayload, TaxPayload, UnitPayload } from "@/types/api/catalog";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

// Anything here changes how products read, so the product views refresh too.
const PRODUCT_KEYS = ["products", "product", "variants"];

const TAX_KEYS = ["taxes", "tax-groups", ...PRODUCT_KEYS];
export function useTaxes() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["taxes", tenant], queryFn: listTaxes });
}
export function useTaxGroups() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["tax-groups", tenant], queryFn: listTaxGroups });
}
export const useCreateTax = () =>
  useInvalidatingMutation<[TaxPayload], unknown>(createTax, TAX_KEYS);
export const useUpdateTax = () =>
  useInvalidatingMutation<[string, Partial<TaxPayload>], unknown>(updateTax, TAX_KEYS);
export const useDeleteTax = () => useInvalidatingMutation<[string], unknown>(deleteTax, TAX_KEYS);
export const useCreateTaxGroup = () =>
  useInvalidatingMutation<[TaxGroupPayload], unknown>(createTaxGroup, TAX_KEYS);
export const useUpdateTaxGroup = () =>
  useInvalidatingMutation<[string, Partial<TaxGroupPayload>], unknown>(updateTaxGroup, TAX_KEYS);
export const useDeleteTaxGroup = () =>
  useInvalidatingMutation<[string], unknown>(deleteTaxGroup, TAX_KEYS);
export const useSetDefaultTaxGroup = () =>
  useInvalidatingMutation<[string], unknown>(setDefaultTaxGroup, TAX_KEYS);

const BRAND_KEYS = ["brands", "units", ...PRODUCT_KEYS];
export function useBrands() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["brands", tenant], queryFn: listBrands });
}
export function useUnits() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["units", tenant], queryFn: listUnits });
}
export const useCreateBrand = () =>
  useInvalidatingMutation<[{ name: string; logo_url?: string | null }], unknown>(
    createBrand,
    BRAND_KEYS,
  );
export const useUpdateBrand = () =>
  useInvalidatingMutation<[string, Partial<Brand>], unknown>(updateBrand, BRAND_KEYS);
export const useDeleteBrand = () =>
  useInvalidatingMutation<[string], unknown>(deleteBrand, BRAND_KEYS);
export const useCreateUnit = () =>
  useInvalidatingMutation<[UnitPayload], unknown>(createUnit, BRAND_KEYS);

const OPTION_KEYS = ["option-types", ...PRODUCT_KEYS];
export function useOptionTypes() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["option-types", tenant], queryFn: listOptionTypes });
}
export const useCreateOptionType = () =>
  useInvalidatingMutation<[{ name: string; presentation?: string | null }], unknown>(
    createOptionType,
    OPTION_KEYS,
  );
export const useCreateOptionValue = () =>
  useInvalidatingMutation<[string, { value: string; hex_color?: string | null }], unknown>(
    createOptionValue,
    OPTION_KEYS,
  );
export const useGenerateVariantMatrix = () =>
  useInvalidatingMutation<[string, string[][], { price?: string; cost?: string }?], unknown>(
    generateVariantMatrix,
    OPTION_KEYS,
  );
export const useAddBarcode = () =>
  useInvalidatingMutation<
    [string, { barcode: string; kind: string; embedded_value?: string | null }],
    unknown
  >(addBarcode, PRODUCT_KEYS);
export const useDeleteBarcode = () =>
  useInvalidatingMutation<[string], unknown>(deleteBarcode, PRODUCT_KEYS);

const MODIFIER_KEYS = ["modifier-groups", ...PRODUCT_KEYS];
export function useModifierGroups(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["modifier-groups", tenant],
    queryFn: listModifierGroups,
    enabled,
  });
}
export const useCreateModifierGroup = () =>
  useInvalidatingMutation<[ModifierGroupPayload], unknown>(createModifierGroup, MODIFIER_KEYS);
export const useUpdateModifierGroup = () =>
  useInvalidatingMutation<[string, Partial<ModifierGroupPayload>], unknown>(
    updateModifierGroup,
    MODIFIER_KEYS,
  );
export const useDeleteModifierGroup = () =>
  useInvalidatingMutation<[string], unknown>(deleteModifierGroup, MODIFIER_KEYS);
export const useAddModifier = () =>
  useInvalidatingMutation<
    [string, { name: string; price_delta?: string | null; is_default?: boolean }],
    unknown
  >(addModifier, MODIFIER_KEYS);
export const useAttachModifierGroup = () =>
  useInvalidatingMutation<[string, string, { is_required?: boolean }?], unknown>(
    attachModifierGroup,
    MODIFIER_KEYS,
  );
export const useDetachModifierGroup = () =>
  useInvalidatingMutation<[string, string], unknown>(detachModifierGroup, MODIFIER_KEYS);
