"use client";

import { useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Field, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import { generateBarcode } from "@/lib/barcode";

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

type ProductFormState = {
  sku: string;
  name: string;
  price: string;
  barcode: string;
  brand: string;
  unit: string;
  product_kind: string;
  duration_minutes: string;
  category: string;
  category_id: string;
};

const emptyForm: ProductFormState = {
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

function toFormState(product?: ProductFormProduct | null): ProductFormState {
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
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(toFormState(product));
    setImage(null);
    void api<{ data: { id: string; name: string }[] }>("/categories")
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, [isOpen, product]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
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
      <form id="product-modal-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <input
              className={fieldClass}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              required
            />
          </Field>
          <Field label={t("inventory.barcode")}>
            <div className="flex gap-2">
              <input
                className={`${fieldClass} min-w-0 flex-1`}
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder={t("inventory.barcodePlaceholder")}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() =>
                  setForm({ ...form, barcode: generateBarcode(activeShopName()) })
                }
              >
                {t("inventory.generateBarcode")}
              </Button>
            </div>
          </Field>
        </div>
        <Field label="Name">
          <input
            className={fieldClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kind">
            <Select
              value={form.product_kind}
              onChange={(v) => setForm({ ...form, product_kind: v })}
              options={[
                { value: "goods", label: "Goods" },
                { value: "service", label: "Service" },
                { value: "combo", label: "Combo" },
              ]}
            />
          </Field>
          <Field label="Unit">
            <Select
              value={form.unit}
              onChange={(v) => setForm({ ...form, unit: v })}
              options={["pcs", "kg", "g", "ml", "l", "box", "pack", "hour", "session"].map(
                (u) => ({ value: u, label: u })
              )}
            />
          </Field>
          <Field label="Branch price">
            <input
              className={fieldClass}
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              onBlur={(e) => {
                if (e.target.value.trim() === "") return;
                setForm({ ...form, price: formatDecimal(e.target.value) });
              }}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand">
            <input
              className={fieldClass}
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <Select
              value={form.category_id}
              onChange={(v) => {
                const cat = categories.find((c) => c.id === v);
                setForm({
                  ...form,
                  category_id: v,
                  category: cat?.name || "",
                });
              }}
              placeholder="Select…"
              options={[
                { value: "", label: "Select…" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>
        </div>
        {form.product_kind === "service" ? (
          <Field label="Duration (minutes)">
            <input
              className={fieldClass}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
              placeholder="e.g. 45"
            />
          </Field>
        ) : null}
        <Field label="Product image">
          <input
            type="file"
            accept="image/*"
            className={fieldClass}
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
        </Field>
      </form>
    </Modal>
  );
}
