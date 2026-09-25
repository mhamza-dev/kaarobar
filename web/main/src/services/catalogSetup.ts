import { apiClient } from "@/lib/api/client";
import type {
  Brand,
  ModifierGroup,
  OptionType,
  OptionValue,
  ProductBarcode,
  ProductVariant,
  Tax,
  TaxGroup,
  TaxGroupPayload,
  TaxPayload,
  Unit,
  UnitPayload,
} from "@/types/api/catalog";
import type { ApiEnvelope } from "@/types/api/common";

const get = async <T>(url: string) => (await apiClient.get<ApiEnvelope<T>>(url)).data.data;
const post = async <T>(url: string, body: unknown = {}) =>
  (await apiClient.post<ApiEnvelope<T>>(url, body)).data.data;
const patch = async <T>(url: string, body: unknown) =>
  (await apiClient.patch<ApiEnvelope<T>>(url, body)).data.data;
const del = async (url: string) => {
  await apiClient.delete(url);
};

// --- Taxes ------------------------------------------------------------------------

export const listTaxes = () => get<Tax[]>("/taxes");
export const createTax = (payload: TaxPayload) => post<Tax>("/taxes", payload);
export const updateTax = (id: string, payload: Partial<TaxPayload>) =>
  patch<Tax>(`/taxes/${id}`, payload);
export const deleteTax = (id: string) => del(`/taxes/${id}`);

export const listTaxGroups = () => get<TaxGroup[]>("/tax-groups");
export const createTaxGroup = (payload: TaxGroupPayload) => post<TaxGroup>("/tax-groups", payload);
export const updateTaxGroup = (id: string, payload: Partial<TaxGroupPayload>) =>
  patch<TaxGroup>(`/tax-groups/${id}`, payload);
/** Refused while products still use the group. */
export const deleteTaxGroup = (id: string) => del(`/tax-groups/${id}`);
/** New products get the default group; the previous default is demoted. */
export const setDefaultTaxGroup = (id: string) => post<TaxGroup>(`/tax-groups/${id}/default`);

// --- Brands and units ---------------------------------------------------------------

export const listBrands = () => get<Brand[]>("/brands");
export const createBrand = (payload: { name: string; slug?: string; logo_url?: string | null }) =>
  post<Brand>("/brands", payload);
export const updateBrand = (id: string, payload: Partial<Brand>) =>
  patch<Brand>(`/brands/${id}`, payload);
export const deleteBrand = (id: string) => del(`/brands/${id}`);

export const listUnits = () => get<Unit[]>("/units");
export const createUnit = (payload: UnitPayload) => post<Unit>("/units", payload);

// --- Variant options ---------------------------------------------------------------

export const listOptionTypes = () => get<OptionType[]>("/option-types");
export const createOptionType = (payload: { name: string; presentation?: string | null }) =>
  post<OptionType>("/option-types", payload);
export const createOptionValue = (
  optionTypeId: string,
  payload: { value: string; hex_color?: string | null },
) => post<OptionValue>(`/option-types/${optionTypeId}/values`, payload);

/**
 * Every combination of the chosen values as variants — `groups` is option
 * value ids grouped by option type. Existing combinations are skipped.
 */
export const generateVariantMatrix = (
  productId: string,
  groups: string[][],
  attrs: { price?: string; cost?: string } = {},
) =>
  post<ProductVariant[]>(`/products/${productId}/variants/matrix`, {
    option_groups: groups,
    ...attrs,
  });

export const addBarcode = (
  variantId: string,
  payload: { barcode: string; kind: string; embedded_value?: string | null },
) => post<ProductBarcode>(`/variants/${variantId}/barcodes`, payload);
export const deleteBarcode = (id: string) => del(`/barcodes/${id}`);

// --- Modifiers -------------------------------------------------------------------

export type ModifierGroupPayload = {
  name: string;
  description?: string | null;
  selection: "single" | "multiple";
  min_select?: number | null;
  max_select?: number | null;
  is_active?: boolean;
};

export const listModifierGroups = () => get<ModifierGroup[]>("/modifier-groups");
export const createModifierGroup = (payload: ModifierGroupPayload) =>
  post<ModifierGroup>("/modifier-groups", payload);
export const updateModifierGroup = (id: string, payload: Partial<ModifierGroupPayload>) =>
  patch<ModifierGroup>(`/modifier-groups/${id}`, payload);
export const deleteModifierGroup = (id: string) => del(`/modifier-groups/${id}`);
export const addModifier = (
  groupId: string,
  payload: { name: string; price_delta?: string | null; is_default?: boolean },
) => post<ModifierGroup>(`/modifier-groups/${groupId}/modifiers`, payload);

export async function attachModifierGroup(
  productId: string,
  groupId: string,
  payload: { is_required?: boolean } = {},
): Promise<void> {
  await apiClient.post(`/products/${productId}/modifier-groups/${groupId}`, payload);
}
export const detachModifierGroup = (productId: string, groupId: string) =>
  del(`/products/${productId}/modifier-groups/${groupId}`);
