"use client";

import { useFormikContext } from "formik";
import SearchSelect, {
  type SearchSelectOption,
} from "@/components/ui/SearchSelect";
import SearchMultiSelect from "@/components/ui/SearchMultiSelect";
import Select from "@/components/ui/Select";
import {
  FormikSearchSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { Field, fieldClass, formStackClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import type {
  AdjustStockFormValues,
  GrnFormValues,
  PurchaseOrderFormValues,
  TransferFormValues,
} from "@/lib/validations/inventory";

export type {
  AdjustStockFormValues,
  AttachSupplierFormValues,
  GrnFormValues,
  PurchaseOrderFormValues,
  TransferFormValues,
} from "@/lib/validations/inventory";
export {
  emptyAdjustStockForm,
  emptyAttachSupplierForm,
  emptyGrnForm,
  emptyPurchaseOrderForm,
  emptyTransferForm,
} from "@/lib/validations/inventory";

type ProductOpt = { id: string; name: string; sku?: string };

type PoItem = {
  product_id: string;
  product_name?: string | null;
  product_sku?: string | null;
  quantity: string;
  unit_cost?: string;
};

type PoOpt = {
  id: string;
  supplier_name?: string;
  status: string;
  items?: PoItem[];
};

export function PurchaseOrderFormFields({
  supplierOptions,
  productOptions,
  products,
  productsLoading,
  onSupplierChange,
  t,
}: {
  supplierOptions: SearchSelectOption[];
  productOptions: SearchSelectOption[];
  products: ProductOpt[];
  productsLoading: boolean;
  onSupplierChange: (supplierId: string) => void;
  t: (key: string) => string;
}) {
  const { values, setValues, setFieldValue } =
    useFormikContext<PurchaseOrderFormValues>();

  return (
    <div className={formStackClass}>
      <Field label={t("inventory.supplier")}>
        <SearchSelect
          options={supplierOptions}
          value={values.supplier_id || null}
          onChange={(supplier_id) => {
            const sid = supplier_id || "";
            void setValues({
              supplier_id: sid,
              product_ids: [],
              quantities: {},
              unit_costs: {},
            });
            onSupplierChange(sid);
          }}
          placeholder={t("inventory.selectSupplier")}
          searchPlaceholder={t("searchSelect.search")}
        />
      </Field>
      <Field label={t("inventory.products")}>
        <SearchMultiSelect
          options={productOptions}
          value={values.product_ids}
          onChange={(product_ids) => {
            void setValues({
              ...values,
              product_ids,
              quantities: Object.fromEntries(
                product_ids.map((id) => [id, values.quantities[id] || "10"])
              ),
              unit_costs: Object.fromEntries(
                product_ids.map((id) => [id, values.unit_costs[id] || "50"])
              ),
            });
          }}
          placeholder={t("pos.searchProducts")}
          searchPlaceholder={t("searchSelect.search")}
          disabled={!values.supplier_id || productsLoading}
        />
      </Field>
      {values.supplier_id && !productsLoading && productOptions.length === 0 ? (
        <p className="text-sm text-body">{t("inventory.poNoSupplierProducts")}</p>
      ) : null}
      {values.supplier_id && productOptions.length > 0 ? (
        <p className="text-sm text-muted">{t("inventory.supplierProductsHint")}</p>
      ) : null}
      {values.product_ids.length > 0 ? (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {t("inventory.quantities")}
          </p>
          {values.product_ids.map((id) => {
            const p = products.find((x) => x.id === id);
            return (
              <div key={id} className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem]">
                <p className="text-sm font-medium text-heading">{p?.name || id}</p>
                <Field label={t("common.quantity")}>
                  <input
                    className={fieldClass}
                    value={values.quantities[id] || ""}
                    onChange={(e) =>
                      void setFieldValue("quantities", {
                        ...values.quantities,
                        [id]: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label={t("inventory.unitCost")}>
                  <input
                    className={fieldClass}
                    type="number"
                    step="0.01"
                    value={values.unit_costs[id] || ""}
                    onChange={(e) =>
                      void setFieldValue("unit_costs", {
                        ...values.unit_costs,
                        [id]: e.target.value,
                      })
                    }
                    onBlur={(e) => {
                      if (e.target.value.trim() === "") return;
                      void setFieldValue("unit_costs", {
                        ...values.unit_costs,
                        [id]: formatDecimal(e.target.value),
                      });
                    }}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function GrnFormFields({
  openPos,
  products,
  t,
}: {
  openPos: PoOpt[];
  products: ProductOpt[];
  t: (key: string) => string;
}) {
  const { values, setValues, setFieldValue } = useFormikContext<GrnFormValues>();
  const selectedPo =
    openPos.find((p) => p.id === values.purchase_order_id) || null;

  return (
    <div className={formStackClass}>
      <Field label={t("inventory.selectPo")}>
        <SearchSelect
          options={openPos.map((p) => ({
            value: p.id,
            label: `${p.supplier_name || p.id.slice(0, 8)} · ${p.status}`,
          }))}
          value={values.purchase_order_id || null}
          onChange={(poId) => {
            if (!poId) {
              void setValues({ purchase_order_id: "", quantities: {} });
              return;
            }
            const po = openPos.find((p) => p.id === poId);
            const quantities: Record<string, string> = {};
            for (const item of po?.items || []) {
              quantities[item.product_id] = item.quantity || "0";
            }
            void setValues({ purchase_order_id: poId, quantities });
          }}
          placeholder={t("inventory.selectPo")}
          searchPlaceholder={t("searchSelect.search")}
        />
      </Field>
      {openPos.length === 0 ? (
        <p className="text-sm text-body">{t("inventory.noOpenPos")}</p>
      ) : null}
      {selectedPo ? (
        <div className="space-y-3 rounded-md border border-border p-3">
          {(selectedPo.items || []).map((item) => (
            <div
              key={item.product_id}
              className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem] sm:items-end"
            >
              <div>
                <p className="text-sm font-medium text-heading">
                  {item.product_name ||
                    products.find((p) => p.id === item.product_id)?.name ||
                    item.product_id}
                </p>
                <p className="text-xs text-muted">
                  {item.product_sku ||
                    products.find((p) => p.id === item.product_id)?.sku ||
                    "—"}{" "}
                  · {t("inventory.orderedQty")}: {item.quantity}
                </p>
              </div>
              <Field label={t("inventory.orderedQty")}>
                <input
                  className={fieldClass}
                  value={item.quantity}
                  disabled
                  readOnly
                />
              </Field>
              <Field label={t("inventory.qtyReceived")}>
                <input
                  className={fieldClass}
                  value={values.quantities[item.product_id] || ""}
                  onChange={(e) =>
                    void setFieldValue("quantities", {
                      ...values.quantities,
                      [item.product_id]: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TransferFormFields({
  branchOptions,
  productOptions,
  productMetaById,
  t,
}: {
  branchOptions: SearchSelectOption[];
  productOptions: SearchSelectOption[];
  productMetaById: Map<string, { name: string; sku?: string }>;
  t: (key: string) => string;
}) {
  const { values, setValues, setFieldValue } =
    useFormikContext<TransferFormValues>();

  return (
    <div className={formStackClass}>
      <Field label={t("inventory.toBranch")}>
        <SearchSelect
          options={branchOptions}
          value={values.to_branch_id || null}
          onChange={(to_branch_id) =>
            void setFieldValue("to_branch_id", to_branch_id || "")
          }
          placeholder={t("inventory.selectToBranch")}
          searchPlaceholder={t("searchSelect.search")}
        />
      </Field>
      <Field label={t("inventory.products")}>
        <SearchMultiSelect
          options={productOptions}
          value={values.product_ids}
          onChange={(product_ids) => {
            const quantities = Object.fromEntries(
              product_ids.map((id) => [id, values.quantities[id] || "1"])
            );
            void setValues({ ...values, product_ids, quantities });
          }}
          placeholder={t("inventory.selectProducts")}
          searchPlaceholder={t("searchSelect.search")}
        />
      </Field>
      {values.product_ids.length > 0 ? (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {t("inventory.quantities")}
          </p>
          {values.product_ids.map((id) => {
            const meta = productMetaById.get(id);
            const displayName = meta?.name || `${id.slice(0, 8)}...`;
            const displaySku = meta?.sku || null;
            return (
              <div key={id} className="grid gap-2 sm:grid-cols-[1fr_7rem] sm:items-end">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-heading">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-muted">{displaySku || id}</p>
                </div>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  className={fieldClass}
                  value={values.quantities[id] || "1"}
                  onChange={(e) =>
                    void setFieldValue("quantities", {
                      ...values.quantities,
                      [id]: e.target.value,
                    })
                  }
                  required
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AdjustStockFormFields({
  productOptions,
  t,
}: {
  productOptions: SearchSelectOption[];
  t: (key: string) => string;
}) {
  return (
    <div className={formStackClass}>
      <FormikSearchSelectField
        name="product_id"
        label={t("inventory.product")}
        options={productOptions}
        placeholder={t("inventory.selectProduct")}
      />
      <FormikTextField
        name="quantity_delta"
        placeholder="Qty delta (e.g. -2 or 5)"
        required
      />
      <Field label="">
        <AdjustReasonSelect />
      </Field>
    </div>
  );
}

function AdjustReasonSelect() {
  const { values, setFieldValue } = useFormikContext<AdjustStockFormValues>();
  return (
    <Select
      value={values.reason_code}
      onChange={(v) => void setFieldValue("reason_code", v)}
      options={[
        "adjustment",
        "damage",
        "theft",
        "count_correction",
        "expired",
        "sample",
      ].map((r) => ({ value: r, label: r }))}
    />
  );
}

export function AttachSupplierFormFields({
  supplierOptions,
  t,
}: {
  supplierOptions: SearchSelectOption[];
  t: (key: string) => string;
}) {
  return (
    <div className={formStackClass}>
      <FormikSearchSelectField
        name="supplier_id"
        label={t("inventory.supplier")}
        options={supplierOptions}
        placeholder={t("inventory.selectSupplier")}
      />
    </div>
  );
}
