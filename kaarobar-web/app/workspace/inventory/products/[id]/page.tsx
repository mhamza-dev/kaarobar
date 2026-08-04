"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import ActionMenu from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import FormModal from "@/components/app/FormModal";
import CustomForm from "@/components/ui/CustomForm";
import { FormikSearchSelectField } from "@/components/ui/FormFields";
import { formStackClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import {
  attachSupplierFormSchema,
  emptyAttachSupplierForm,
  type AttachSupplierFormValues,
} from "@/lib/validations/inventory";

type Product = {
  id: string;
  sku: string;
  name: string;
  price?: string | null;
  barcode?: string | null;
  brand?: string | null;
  unit?: string | null;
  description?: string | null;
  product_kind?: string | null;
  track_inventory?: boolean;
  duration_minutes?: number | null;
  tax_rate?: string | null;
  is_active?: boolean;
  category?: string | null;
  category_ref?: { id: string; name: string; slug?: string } | null;
};

type ProductSupplier = {
  id: string;
  supplier_id: string;
  is_primary?: boolean;
  name?: string | null;
  code?: string | null;
};

type StockRow = {
  product_id: string;
  quantity_on_hand: string;
};

type SupplierOption = { id: string; name: string };

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<SupplierOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, stockRes, supRes] = await Promise.all([
        api<{ data: Product }>(`/products/${id}`),
        api<{ data: StockRow[] }>("/inventory").catch(() => ({ data: [] as StockRow[] })),
        api<{ data: ProductSupplier[] }>(`/products/${id}/suppliers`).catch(() => ({
          data: [] as ProductSupplier[],
        })),
      ]);
      setProduct(prodRes.data);
      const row = (stockRes.data || []).find((r) => r.product_id === id);
      setStockQty(row?.quantity_on_hand ?? null);
      setSuppliers(supRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openAttach() {
    setAttachOpen(true);
    try {
      const res = await api<{ data: SupplierOption[] }>("/suppliers");
      setAllSuppliers(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const attachOptions = useMemo(() => {
    const linked = new Set(suppliers.map((s) => s.supplier_id));
    return allSuppliers
      .filter((s) => !linked.has(s.id))
      .map((s) => ({ value: s.id, label: s.name }));
  }, [allSuppliers, suppliers]);

  async function attachSupplier(values: AttachSupplierFormValues) {
    if (!id || !values.supplier_id) return;
    setBusy(true);
    try {
      await api(`/products/${id}/suppliers`, {
        method: "POST",
        body: JSON.stringify({ supplier_id: values.supplier_id }),
      });
      toast.success(t("inventory.supplierAttached"));
      setAttachOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function detachSupplier(supplierId: string) {
    if (!id) return;
    if (!confirm(t("inventory.detachSupplierConfirm"))) return;
    setBusy(true);
    try {
      await api(`/products/${id}/suppliers/${supplierId}`, { method: "DELETE" });
      toast.success(t("inventory.supplierDetached"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const categoryLabel = product?.category_ref?.name || product?.category || "—";

  return (
    <>
      <DetailShell
        backHref={`${routes.inventory}?tab=products`}
        backLabel={t("inventory.backToProducts")}
        eyebrow={t("inventory.productEyebrow")}
        title={product?.name || t("inventory.product")}
        subtitle={product?.sku}
        status={
          product
            ? {
                label:
                  product.is_active === false
                    ? t("businesses.inactive")
                    : t("businesses.active"),
                tone: product.is_active === false ? "warning" : "success",
              }
            : undefined
        }
        actions={
          <Button
            size="sm"
            onClick={() => void openAttach()}
            startIcon={<PackagePlus className="h-4 w-4" />}
          >
            {t("table.attachSupplier")}
          </Button>
        }
        loading={loading}
        error={error}
      >
        {product ? (
          <>
            <DetailSection title={t("inventory.catalogSection")}>
              <DetailFieldGrid
                fields={[
                  { label: t("inventory.sku"), value: product.sku },
                  { label: t("inventory.barcode"), value: product.barcode || "—" },
                  { label: t("inventory.brand"), value: product.brand || "—" },
                  { label: t("inventory.category"), value: categoryLabel },
                  { label: t("inventory.kind"), value: product.product_kind || "—" },
                  { label: t("inventory.unit"), value: product.unit || "—" },
                  {
                    label: t("inventory.price"),
                    value: product.price ? `Rs ${formatDecimal(product.price)}` : "—",
                  },
                  {
                    label: t("inventory.taxRate"),
                    value: product.tax_rate != null ? product.tax_rate : "—",
                  },
                  {
                    label: t("inventory.stock"),
                    value: stockQty != null ? formatDecimal(stockQty) : "—",
                  },
                  {
                    label: t("inventory.trackInventory"),
                    value:
                      product.track_inventory === false
                        ? t("common.no")
                        : t("common.yes"),
                  },
                  {
                    label: t("inventory.durationMinutes"),
                    value:
                      product.duration_minutes != null
                        ? String(product.duration_minutes)
                        : "—",
                  },
                ]}
              />
              {product.description ? (
                <p className="mt-4 text-sm text-body">{product.description}</p>
              ) : null}
            </DetailSection>

            <DetailSection title={t("inventory.productSuppliers")}>
              <DataTable
                maxHeight="24rem"
                columns={[
                  {
                    id: "name",
                    header: t("common.name"),
                    cell: (s) => (
                      <span className="font-semibold text-heading">
                        {s.name || s.supplier_id.slice(0, 8)}
                        {s.is_primary ? (
                          <span className="ms-2 text-xs font-medium text-brand">
                            {t("inventory.primary")}
                          </span>
                        ) : null}
                      </span>
                    ),
                  },
                  {
                    id: "code",
                    header: t("inventory.code"),
                    cell: (s) => s.code || "—",
                  },
                  {
                    id: "actions",
                    header: "",
                    align: "right",
                    width: 48,
                    cell: (s) => (
                      <div className="flex justify-end">
                        <ActionMenu
                          items={[
                            {
                              id: "remove",
                              label: t("inventory.detachSupplier"),
                              tone: "danger",
                              onClick: () => void detachSupplier(s.supplier_id),
                              disabled: busy,
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                ]}
                data={suppliers}
                rowKey={(s) => s.id}
                emptyTitle={t("inventory.noProductSuppliers")}
                emptyBody={t("inventory.noProductSuppliersBody")}
              />
            </DetailSection>
          </>
        ) : null}
      </DetailShell>

      <FormModal
        isOpen={attachOpen}
        onClose={() => setAttachOpen(false)}
        title={t("table.attachSupplier")}
        description={t("inventory.attachSupplierDesc")}
        formId="attach-supplier-to-product-form"
        submitLabel={t("table.attachSupplier")}
        cancelLabel={t("common.cancel")}
        submitLoading={busy}
        submitDisabled={attachOptions.length === 0}
        submitIcon={<PackagePlus className="h-4 w-4" />}
      >
        <CustomForm
          id="attach-supplier-to-product-form"
          initialValues={emptyAttachSupplierForm()}
          validationSchema={attachSupplierFormSchema}
          onSubmit={attachSupplier}
          className={formStackClass}
        >
          {() => (
            <>
              <FormikSearchSelectField
                name="supplier_id"
                label={t("inventory.supplier")}
                options={attachOptions}
                placeholder={t("inventory.selectSupplier")}
              />
              {attachOptions.length === 0 ? (
                <p className="text-sm text-body">{t("inventory.allSuppliersLinked")}</p>
              ) : null}
            </>
          )}
        </CustomForm>
      </FormModal>
    </>
  );
}
