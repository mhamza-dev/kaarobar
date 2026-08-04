import { useEffect, useState } from "react";
import { useField } from "formik";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { Field, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import { generateBarcode } from "@/lib/barcode";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/lib/validations/products";

function activeShopName(): string | null {
  const session = getSession();
  if (!session?.business_id) return null;
  return (
    session.memberships?.find((m) => m.business_id === session.business_id)
      ?.business_name || null
  );
}

export type ProductFormProduct = {
  id: string;
  sku?: string | null;
  name?: string | null;
  price?: string | null;
  barcode?: string | null;
  brand?: string | null;
  unit?: string | null;
  product_kind?: string | null;
  duration_minutes?: number | null;
  category?: string | null;
  category_id?: string | null;
};

const emptyForm: ProductFormValues = {
  sku: "",
  name: "",
  price: "",
  barcode: "",
  brand: "",
  unit: "pcs",
  product_kind: "goods",
  duration_minutes: "",
  category: "",
  category_id: "",
};

function toFormState(product?: ProductFormProduct | null): ProductFormValues {
  if (!product) return emptyForm;
  return {
    sku: product.sku || "",
    name: product.name || "",
    price: product.price || "",
    barcode: product.barcode || "",
    brand: product.brand || "",
    unit: product.unit || "pcs",
    product_kind: product.product_kind || "goods",
    duration_minutes:
      product.duration_minutes != null ? String(product.duration_minutes) : "",
    category: product.category || "",
    category_id: product.category_id || "",
  };
}

function FormikDecimalField({
  name,
  label,
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div>
      <Field label={label}>
        <input
          {...field}
          type="number"
          step="0.01"
          min={0}
          required={required}
          className={fieldClass}
          onBlur={(e) => {
            field.onBlur(e);
            if (e.target.value.trim() === "") return;
            void helpers.setValue(formatDecimal(e.target.value));
          }}
        />
      </Field>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** When set, modal edits this product; otherwise creates. */
  product?: ProductFormProduct | null;
  onSuccess?: (product: ProductFormProduct) => void | Promise<void>;
};

export default function ProductFormModal({
  isOpen,
  onClose,
  product = null,
  onSuccess,
}: Props) {
  const t = useT();
  const toast = useToast();
  const editing = !!product?.id;
  const [image, setImage] = useState<File | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    []
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setImage(null);
    void api<{ data: { id: string; name: string }[] }>("/categories")
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, [isOpen, product]);

  async function handleSubmit(values: ProductFormValues) {
    setBusy(true);
    try {
      const cat = categories.find((c) => c.id === values.category_id);
      const payload: ProductFormValues = {
        ...values,
        category: cat?.name || values.category || "",
      };
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v) fd.append(k, String(v));
      });
      if (image) fd.append("image", image);

      const res = editing
        ? await api<{ data: ProductFormProduct }>(`/products/${product!.id}`, {
            method: "PATCH",
            body: fd,
          })
        : await api<{ data: ProductFormProduct }>("/products", {
            method: "POST",
            body: fd,
          });

      toast.success(
        editing ? t("inventory.productUpdated") : t("inventory.productCreated")
      );
      onClose();
      await onSuccess?.(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("inventory.editProduct") : t("inventory.newProduct")}
      description={
        editing
          ? "Update catalog details and branch price for the active branch."
          : "Works for retail, restaurant, salon, pharmacy, and general shops. Add barcode and photo for faster POS."
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="product-modal-form" loading={busy}>
            {editing ? "Save changes" : "Create product"}
          </Button>
        </div>
      }
    >
      <CustomForm<ProductFormValues>
        id="product-modal-form"
        className="space-y-4"
        initialValues={toFormState(product)}
        validationSchema={productFormSchema}
        enableReinitialize
        onSubmit={handleSubmit}
      >
        {({ values, setFieldValue }) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormikTextField name="sku" label="SKU" required />
              <div>
                <Field label={t("inventory.barcode")}>
                  <div className="flex gap-2">
                    <input
                      className={`${fieldClass} min-w-0 flex-1`}
                      value={values.barcode || ""}
                      onChange={(e) =>
                        void setFieldValue("barcode", e.target.value)
                      }
                      placeholder={t("inventory.barcodePlaceholder")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() =>
                        void setFieldValue(
                          "barcode",
                          generateBarcode(activeShopName())
                        )
                      }
                    >
                      {t("inventory.generateBarcode")}
                    </Button>
                  </div>
                </Field>
              </div>
            </div>
            <FormikTextField name="name" label="Name" required />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormikSelectField
                name="product_kind"
                label="Kind"
                options={[
                  { value: "goods", label: "Goods" },
                  { value: "service", label: "Service" },
                  { value: "combo", label: "Combo" },
                ]}
              />
              <FormikSelectField
                name="unit"
                label="Unit"
                options={[
                  "pcs",
                  "kg",
                  "g",
                  "ml",
                  "l",
                  "box",
                  "pack",
                  "hour",
                  "session",
                ].map((u) => ({ value: u, label: u }))}
              />
              <FormikDecimalField name="price" label="Branch price" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormikTextField name="brand" label="Brand" />
              <FormikSelectField
                name="category_id"
                label="Category"
                selectedLabel={values.category || undefined}
                placeholder="Select…"
                options={[
                  { value: "", label: "Select…" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            {values.product_kind === "service" ? (
              <FormikTextField
                name="duration_minutes"
                label="Duration (minutes)"
                placeholder="e.g. 45"
              />
            ) : null}
            <Field label="Product image">
              <input
                type="file"
                accept="image/*"
                className={fieldClass}
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
            </Field>
          </>
        )}
      </CustomForm>
    </Modal>
  );
}
