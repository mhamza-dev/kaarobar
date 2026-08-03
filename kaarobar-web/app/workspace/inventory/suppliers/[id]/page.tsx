"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import { StatusBadge } from "@/components/app/ui";
import ActionMenu from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/modals/Modal";
import SearchSelect from "@/components/ui/SearchSelect";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";

type Supplier = {
  id: string;
  name: string;
  legal_name?: string | null;
  code?: string | null;
  status?: string | null;
  is_preferred?: boolean;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_role?: string | null;
  contact_mobile?: string | null;
  city?: string | null;
  province?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  lead_time_days?: number | null;
};

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  price?: string | null;
};

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const toast = useToast();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachProductId, setAttachProductId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [supRes, prodRes] = await Promise.all([
        api<{ data: Supplier }>(`/suppliers/${id}`),
        api<{ data: Product[] }>(`/suppliers/${id}/products`),
      ]);
      setSupplier(supRes.data);
      setProducts(prodRes.data || []);
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
    setAttachProductId(null);
    setAttachOpen(true);
    try {
      const res = await api<{ data: Product[] }>("/products");
      setAllProducts(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const attachOptions = useMemo(() => {
    const linked = new Set(products.map((p) => p.id));
    return allProducts
      .filter((p) => !linked.has(p.id))
      .map((p) => ({
        value: p.id,
        label: p.sku ? `${p.name} (${p.sku})` : p.name,
      }));
  }, [allProducts, products]);

  async function attachProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!attachProductId) return;
    setBusy(true);
    try {
      await api(`/suppliers/${id}/products`, {
        method: "POST",
        body: JSON.stringify({ product_id: attachProductId }),
      });
      toast.success(t("inventory.productAttached"));
      setAttachOpen(false);
      setAttachProductId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function detachProduct(productId: string) {
    if (!confirm(t("inventory.detachProductConfirm"))) return;
    setBusy(true);
    try {
      await api(`/suppliers/${id}/products/${productId}`, { method: "DELETE" });
      toast.success(t("inventory.productDetached"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const statusTone =
    supplier?.status === "active"
      ? "success"
      : supplier?.status === "blocked"
        ? "danger"
        : "info";

  return (
    <>
      <DetailShell
        backHref={`${routes.inventory}?tab=suppliers`}
        backLabel={t("inventory.backToSuppliers")}
        eyebrow={t("inventory.supplierEyebrow")}
        title={supplier?.name || t("inventory.supplier")}
        infoKey="page.inventory.supplier"
        subtitle={
          [supplier?.city, supplier?.is_preferred ? t("inventory.preferred") : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        status={
          supplier?.status
            ? { label: supplier.status, tone: statusTone }
            : undefined
        }
        actions={
          <Button
            size="sm"
            onClick={() => void openAttach()}
            startIcon={<PackagePlus className="h-4 w-4" />}
          >
            {t("inventory.attachProduct")}
          </Button>
        }
        loading={loading}
        error={error}
      >
        {supplier ? (
          <>
            <DetailSection title={t("inventory.contactSection")}>
              <DetailFieldGrid
                fields={[
                  { label: t("common.name"), value: supplier.contact_name || "—" },
                  { label: t("inventory.role"), value: supplier.contact_role || "—" },
                  { label: t("customers.phone"), value: supplier.contact_phone || "—" },
                  { label: t("auth.email"), value: supplier.contact_email || "—" },
                  {
                    label: t("inventory.mobile"),
                    value: supplier.contact_mobile || "—",
                  },
                ]}
              />
            </DetailSection>

            <DetailSection title={t("inventory.addressSection")}>
              <DetailFieldGrid
                fields={[
                  {
                    label: t("inventory.address"),
                    value:
                      [supplier.address_line1, supplier.address_line2]
                        .filter(Boolean)
                        .join(", ") || "—",
                  },
                  { label: t("inventory.city"), value: supplier.city || "—" },
                  { label: t("inventory.province"), value: supplier.province || "—" },
                ]}
              />
            </DetailSection>

            <DetailSection title={t("inventory.paymentSection")}>
              <DetailFieldGrid
                fields={[
                  {
                    label: t("inventory.paymentTerms"),
                    value: supplier.payment_terms || "—",
                  },
                  {
                    label: t("inventory.paymentMethod"),
                    value: supplier.payment_method || "—",
                  },
                  {
                    label: t("inventory.leadTime"),
                    value:
                      supplier.lead_time_days != null
                        ? String(supplier.lead_time_days)
                        : "—",
                  },
                  {
                    label: t("common.status"),
                    value: (
                      <StatusBadge tone={statusTone}>
                        {supplier.status || "—"}
                      </StatusBadge>
                    ),
                  },
                ]}
              />
            </DetailSection>

            <DetailSection title={t("inventory.supplierProducts")}>
              <DataTable
                maxHeight="24rem"
                columns={[
                  {
                    id: "name",
                    header: t("common.name"),
                    cell: (p) => (
                      <span className="font-semibold text-heading">{p.name}</span>
                    ),
                  },
                  {
                    id: "sku",
                    header: t("inventory.sku"),
                    cell: (p) => p.sku || "—",
                  },
                  {
                    id: "unit",
                    header: t("inventory.unit"),
                    cell: (p) => p.unit || "—",
                  },
                  {
                    id: "price",
                    header: t("inventory.price"),
                    cell: (p) =>
                      p.price != null && p.price !== ""
                        ? formatDecimal(p.price)
                        : "—",
                  },
                  {
                    id: "actions",
                    header: "",
                    align: "right",
                    width: 48,
                    cell: (p) => (
                      <div className="flex justify-end">
                        <ActionMenu
                          items={[
                            {
                              id: "remove",
                              label: t("inventory.detachProduct"),
                              tone: "danger",
                              onClick: () => void detachProduct(p.id),
                              disabled: busy,
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                ]}
                data={products}
                rowKey={(p) => p.id}
                emptyTitle={t("inventory.noSupplierProducts")}
                emptyBody={t("inventory.noSupplierProductsBody")}
              />
            </DetailSection>
          </>
        ) : null}
      </DetailShell>

      <Modal
        isOpen={attachOpen}
        onClose={() => setAttachOpen(false)}
        title={t("inventory.attachProduct")}
        description={t("inventory.attachProductDesc")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAttachOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              form="attach-product-form"
              loading={busy}
              disabled={!attachProductId}
              startIcon={<PackagePlus className="h-4 w-4" />}
            >
              {t("inventory.attachProduct")}
            </Button>
          </div>
        }
      >
        <form id="attach-product-form" onSubmit={attachProduct} className="space-y-3">
          <SearchSelect
            label={t("inventory.product")}
            options={attachOptions}
            value={attachProductId}
            onChange={setAttachProductId}
            placeholder={t("inventory.selectProduct")}
            searchPlaceholder={t("searchSelect.search")}
          />
          {attachOptions.length === 0 ? (
            <p className="text-sm text-body">{t("inventory.allProductsLinked")}</p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
