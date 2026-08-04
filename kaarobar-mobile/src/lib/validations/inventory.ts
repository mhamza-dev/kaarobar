import * as yup from "yup";

/** Re-export product/supplier schemas (canonical: `./products`). */
export {
  productFormSchema,
  supplierFormSchema,
  emptyProductForm,
  emptySupplierForm,
  type ProductFormValues,
  type SupplierFormValues,
} from "./products";

export type PurchaseOrderFormValues = {
  supplier_id: string;
  product_ids: string[];
  quantities: Record<string, string>;
  unit_costs: Record<string, string>;
};

export const emptyPurchaseOrderForm = (): PurchaseOrderFormValues => ({
  supplier_id: "",
  product_ids: [],
  quantities: {},
  unit_costs: {},
});

export const purchaseOrderFormSchema: yup.ObjectSchema<PurchaseOrderFormValues> =
  yup
    .object({
      supplier_id: yup.string().trim().required("Select a supplier"),
      product_ids: yup
        .array()
        .of(yup.string().required())
        .min(1, "Select at least one product")
        .required(),
      quantities: yup.mixed<Record<string, string>>().default({}),
      unit_costs: yup.mixed<Record<string, string>>().default({}),
    })
    .test(
      "qty-positive",
      "Enter a quantity greater than zero for each product",
      (values) => {
        if (!values?.product_ids?.length) return true;
        return values.product_ids.some(
          (id) => Number(values.quantities?.[id] || "0") > 0
        );
      }
    );

export type GrnFormValues = {
  purchase_order_id: string;
  quantities: Record<string, string>;
};

export const emptyGrnForm = (): GrnFormValues => ({
  purchase_order_id: "",
  quantities: {},
});

export const grnFormSchema: yup.ObjectSchema<GrnFormValues> = yup
  .object({
    purchase_order_id: yup.string().trim().required("Select a purchase order"),
    quantities: yup.mixed<Record<string, string>>().default({}),
  })
  .test(
    "qty-received",
    "Enter a received quantity greater than zero",
    (values) => {
      const qtys = values?.quantities || {};
      return Object.values(qtys).some((q) => Number(q || "0") > 0);
    }
  );

export type TransferFormValues = {
  to_branch_id: string;
  product_ids: string[];
  quantities: Record<string, string>;
};

export const emptyTransferForm = (): TransferFormValues => ({
  to_branch_id: "",
  product_ids: [],
  quantities: {},
});

export const transferFormSchema: yup.ObjectSchema<TransferFormValues> = yup.object({
  to_branch_id: yup.string().trim().required("Select a destination branch"),
  product_ids: yup
    .array()
    .of(yup.string().required())
    .min(1, "Select at least one product")
    .required(),
  quantities: yup.mixed<Record<string, string>>().default({}),
});

export type AdjustStockFormValues = {
  product_id: string;
  quantity_delta: string;
  reason_code: string;
};

export const emptyAdjustStockForm = (): AdjustStockFormValues => ({
  product_id: "",
  quantity_delta: "",
  reason_code: "adjustment",
});

export const adjustStockFormSchema: yup.ObjectSchema<AdjustStockFormValues> =
  yup.object({
    product_id: yup.string().trim().required("Select a product"),
    quantity_delta: yup.string().trim().required("Quantity delta is required"),
    reason_code: yup.string().trim().required("Reason is required"),
  });

export type AttachSupplierFormValues = {
  supplier_id: string;
};

export const emptyAttachSupplierForm = (): AttachSupplierFormValues => ({
  supplier_id: "",
});

export const attachSupplierFormSchema: yup.ObjectSchema<AttachSupplierFormValues> =
  yup.object({
    supplier_id: yup.string().trim().required("Select a supplier"),
  });

export type AttachProductFormValues = {
  product_id: string;
};

export const emptyAttachProductForm = (): AttachProductFormValues => ({
  product_id: "",
});

export const attachProductFormSchema: yup.ObjectSchema<AttachProductFormValues> =
  yup.object({
    product_id: yup.string().trim().required("Select a product"),
  });
