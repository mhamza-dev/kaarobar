"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import {
  Field,
  PageHeader,
  SurfaceCard,
  TabBar,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import { generateBarcode } from "@/lib/barcode";
import { useTabQueryParam } from "@/lib/hooks/useTabQueryParam";
import { detailRoutes, routes } from "@/lib/navigation";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";
import { formatLocalDateTime } from "@/lib/datetime";
import SearchSelect from "@/components/ui/SearchSelect";
import SearchMultiSelect from "@/components/ui/SearchMultiSelect";
import Select from "@/components/ui/Select";
import { inventoryKeys } from "@/lib/queryClient";

type Tab = "stock" | "products" | "suppliers" | "pos" | "transfers" | "adjust";
const INVENTORY_TABS: readonly Tab[] = [
  "stock",
  "products",
  "suppliers",
  "pos",
  "transfers",
  "adjust",
];
type ModalKind = "product" | "supplier" | "po" | "transfer" | null;

const emptyProductForm = {
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

type Product = {
  id: string;
  sku: string;
  name: string;
  price?: string;
  barcode?: string;
  brand?: string;
  unit?: string;
  product_kind?: string;
  duration_minutes?: number;
  image_url?: string;
  category?: string;
  category_id?: string;
  is_active?: boolean;
};
type StockRow = {
  product_id: string;
  sku?: string;
  name?: string;
  quantity_on_hand: string;
  avg_cost: string;
};
type Supplier = {
  id: string;
  name: string;
  legal_name?: string | null;
  code?: string | null;
  tax_id?: string | null;
  strn?: string | null;
  website?: string | null;
  industry?: string | null;
  status?: string;
  notes?: string | null;
  is_preferred?: boolean;
  rating?: number | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_mobile?: string | null;
  contact_whatsapp?: string | null;
  contact_cnic?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  bank_name?: string | null;
  bank_iban?: string | null;
  bank_account_title?: string | null;
  credit_limit?: string | null;
  currency?: string | null;
  lead_time_days?: number | null;
  minimum_order_amount?: string | null;
  catalogs?: string[];
  brands?: string[];
  tags?: string[];
};

const emptySupplierForm = {
  name: "",
  legal_name: "",
  code: "",
  tax_id: "",
  strn: "",
  website: "",
  industry: "",
  status: "active",
  notes: "",
  is_preferred: false,
  rating: "",
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_phone: "",
  contact_mobile: "",
  contact_whatsapp: "",
  contact_cnic: "",
  address_line1: "",
  address_line2: "",
  city: "",
  province: "",
  postal_code: "",
  country: "PK",
  payment_terms: "Net 30",
  payment_method: "bank_transfer",
  bank_name: "",
  bank_iban: "",
  bank_account_title: "",
  credit_limit: "",
  currency: "PKR",
  lead_time_days: "",
  minimum_order_amount: "",
  catalogs: "",
  brands: "",
  tags: "",
};
type PO = {
  id: string;
  status: string;
  supplier_name?: string;
  supplier_id: string;
  items: { product_id: string; quantity: string; unit_cost: string }[];
};
type Transfer = {
  id: string;
  status: string;
  from_branch_id?: string;
  to_branch_id?: string;
  inserted_at?: string;
  items: { product_id: string; quantity: string }[];
};

type BranchOpt = { id: string; name: string };

export default function InventoryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-body">Loading…</p>}>
      <InventoryPageInner />
    </Suspense>
  );
}

function InventoryPageInner() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = getSession();
  const businessId = session?.business_id ?? null;
  const [tab, setTab] = useTabQueryParam<Tab>("stock", INVENTORY_TABS, {
    basePath: routes.inventory,
  });
  const [modal, setModal] = useState<ModalKind>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productFilters, setProductFilters] = useState<StaffListFilterState>(
    emptyStaffListFilters()
  );
  const [stockFilters, setStockFilters] = useState(emptyStaffListFilters);
  const [transferFilters, setTransferFilters] = useState(emptyStaffListFilters);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [poForm, setPoForm] = useState<{
    supplier_id: string;
    product_ids: string[];
    quantities: Record<string, string>;
    unit_costs: Record<string, string>;
  }>({
    supplier_id: "",
    product_ids: [],
    quantities: {},
    unit_costs: {},
  });
  const [attachSupplierProductId, setAttachSupplierProductId] = useState<
    string | null
  >(null);
  const [attachSupplierId, setAttachSupplierId] = useState<string | null>(null);
  const [grnForm, setGrnForm] = useState({
    purchase_order_id: "",
    product_id: "",
    quantity_received: "",
  });
  const [transferForm, setTransferForm] = useState<{
    to_branch_id: string;
    product_ids: string[];
    quantities: Record<string, string>;
  }>({
    to_branch_id: "",
    product_ids: [],
    quantities: {},
  });
  const [adjustForm, setAdjustForm] = useState({
    product_id: "",
    quantity_delta: "",
    reason_code: "adjustment",
  });

  const needProducts =
    tab === "products" || tab === "pos" || tab === "transfers" || tab === "adjust";
  const needSuppliers =
    tab === "suppliers" || tab === "pos" || !!attachSupplierProductId || modal === "po";

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: inventoryKeys.products(businessId),
    queryFn: async () => {
      const res = await api<{ data: Product[] }>("/products");
      return res.data || [];
    },
    enabled: needProducts,
  });

  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: inventoryKeys.stock(businessId),
    queryFn: async () => {
      const res = await api<{ data: StockRow[] }>("/inventory").catch(() => ({
        data: [] as StockRow[],
      }));
      return res.data || [];
    },
    enabled: tab === "stock",
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: inventoryKeys.suppliers(businessId),
    queryFn: async () => {
      const res = await api<{ data: Supplier[] }>("/suppliers").catch(() => ({
        data: [] as Supplier[],
      }));
      return res.data || [];
    },
    enabled: needSuppliers,
  });

  const { data: pos = [], isLoading: posLoading } = useQuery({
    queryKey: inventoryKeys.purchaseOrders(businessId),
    queryFn: async () => {
      const res = await api<{ data: PO[] }>("/inventory/purchase-orders").catch(
        () => ({ data: [] as PO[] })
      );
      return res.data || [];
    },
    enabled: tab === "pos",
  });

  const { data: transfers = [], isLoading: transfersLoading } = useQuery({
    queryKey: inventoryKeys.transfers(businessId),
    queryFn: async () => {
      const res = await api<{ data: Transfer[] }>("/inventory/transfers").catch(
        () => ({ data: [] as Transfer[] })
      );
      return res.data || [];
    },
    enabled: tab === "transfers",
  });

  const { data: categories = [] } = useQuery({
    queryKey: inventoryKeys.categories(businessId),
    queryFn: async () => {
      const res = await api<{ data: { id: string; name: string }[] }>(
        "/categories"
      ).catch(() => ({ data: [] as { id: string; name: string }[] }));
      return res.data || [];
    },
    enabled: tab === "products",
  });

  const { data: branches = [] } = useQuery({
    queryKey: inventoryKeys.branches(businessId),
    queryFn: async () => {
      if (!businessId) return [] as BranchOpt[];
      const res = await api<{ data: BranchOpt[] }>(
        `/businesses/${businessId}/branches`
      ).catch(() => ({ data: [] as BranchOpt[] }));
      return res.data || [];
    },
    enabled: tab === "transfers" && !!businessId,
  });

  async function refreshInventory() {
    await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
  }

  const branchOptions = useMemo(() => {
    return (branches || [])
      .filter((b) => b.id !== session?.branch_id)
      .map((b) => ({ value: b.id, label: b.name }));
  }, [branches, session?.branch_id]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
    [products]
  );

  function openNewProduct() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setProductImage(null);
    setModal("product");
  }

  function openEditProduct(p: Product) {
    setEditingProductId(p.id);
    setProductForm({
      sku: p.sku || "",
      name: p.name || "",
      price: p.price || "",
      barcode: p.barcode || "",
      brand: p.brand || "",
      unit: p.unit || "pcs",
      product_kind: p.product_kind || "goods",
      duration_minutes: p.duration_minutes != null ? String(p.duration_minutes) : "",
      category: p.category || "",
      category_id: p.category_id || "",
    });
    setProductImage(null);
    setModal("product");
  }

  function closeProductModal() {
    setModal(null);
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setProductImage(null);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(productForm).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      if (productImage) fd.append("image", productImage);

      if (editingProductId) {
        await api(`/products/${editingProductId}`, { method: "PATCH", body: fd });
        toast.success(t("inventory.productUpdated"));
      } else {
        await api("/products", { method: "POST", body: fd });
        toast.success(t("inventory.productCreated"));
      }
      closeProductModal();
      setTab("products");
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  function openNewSupplier() {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplierForm);
    setModal("supplier");
  }

  function openEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id);
    setSupplierForm({
      name: s.name || "",
      legal_name: s.legal_name || "",
      code: s.code || "",
      tax_id: s.tax_id || "",
      strn: s.strn || "",
      website: s.website || "",
      industry: s.industry || "",
      status: s.status || "active",
      notes: s.notes || "",
      is_preferred: Boolean(s.is_preferred),
      rating: s.rating != null ? String(s.rating) : "",
      contact_name: s.contact_name || "",
      contact_role: s.contact_role || "",
      contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "",
      contact_mobile: s.contact_mobile || "",
      contact_whatsapp: s.contact_whatsapp || "",
      contact_cnic: s.contact_cnic || "",
      address_line1: s.address_line1 || "",
      address_line2: s.address_line2 || "",
      city: s.city || "",
      province: s.province || "",
      postal_code: s.postal_code || "",
      country: s.country || "PK",
      payment_terms: s.payment_terms || "Net 30",
      payment_method: s.payment_method || "bank_transfer",
      bank_name: s.bank_name || "",
      bank_iban: s.bank_iban || "",
      bank_account_title: s.bank_account_title || "",
      credit_limit: s.credit_limit || "",
      currency: s.currency || "PKR",
      lead_time_days: s.lead_time_days != null ? String(s.lead_time_days) : "",
      minimum_order_amount: s.minimum_order_amount || "",
      catalogs: (s.catalogs || []).join(", "),
      brands: (s.brands || []).join(", "),
      tags: (s.tags || []).join(", "),
    });
    setModal("supplier");
  }

  function closeSupplierModal() {
    setModal(null);
    setEditingSupplierId(null);
    setSupplierForm(emptySupplierForm);
  }

  function supplierPayload() {
    const splitList = (v: string) =>
      v
        .split(/[,;\n]/)
        .map((x) => x.trim())
        .filter(Boolean);

    return {
      name: supplierForm.name.trim(),
      legal_name: supplierForm.legal_name.trim() || null,
      code: supplierForm.code.trim() || null,
      tax_id: supplierForm.tax_id.trim() || null,
      strn: supplierForm.strn.trim() || null,
      website: supplierForm.website.trim() || null,
      industry: supplierForm.industry.trim() || null,
      status: supplierForm.status,
      notes: supplierForm.notes.trim() || null,
      is_preferred: supplierForm.is_preferred,
      rating: supplierForm.rating ? Number(supplierForm.rating) : null,
      contact_name: supplierForm.contact_name.trim() || null,
      contact_role: supplierForm.contact_role.trim() || null,
      contact_email: supplierForm.contact_email.trim() || null,
      contact_phone: supplierForm.contact_phone.trim() || null,
      contact_mobile: supplierForm.contact_mobile.trim() || null,
      contact_whatsapp: supplierForm.contact_whatsapp.trim() || null,
      contact_cnic: supplierForm.contact_cnic.trim() || null,
      address_line1: supplierForm.address_line1.trim() || null,
      address_line2: supplierForm.address_line2.trim() || null,
      city: supplierForm.city.trim() || null,
      province: supplierForm.province.trim() || null,
      postal_code: supplierForm.postal_code.trim() || null,
      country: supplierForm.country.trim() || "PK",
      payment_terms: supplierForm.payment_terms.trim() || null,
      payment_method: supplierForm.payment_method || null,
      bank_name: supplierForm.bank_name.trim() || null,
      bank_iban: supplierForm.bank_iban.trim() || null,
      bank_account_title: supplierForm.bank_account_title.trim() || null,
      credit_limit: supplierForm.credit_limit.trim() || null,
      currency: supplierForm.currency.trim() || "PKR",
      lead_time_days: supplierForm.lead_time_days
        ? Number(supplierForm.lead_time_days)
        : null,
      minimum_order_amount: supplierForm.minimum_order_amount.trim() || null,
      catalogs: splitList(supplierForm.catalogs),
      brands: splitList(supplierForm.brands),
      tags: splitList(supplierForm.tags),
      contact: {
        phone: supplierForm.contact_phone.trim() || null,
        email: supplierForm.contact_email.trim() || null,
      },
    };
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = supplierPayload();
      if (editingSupplierId) {
        await api(`/suppliers/${editingSupplierId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success(t("inventory.supplierUpdated"));
      } else {
        await api("/suppliers", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success(t("inventory.supplierAdded"));
      }
      closeSupplierModal();
      setTab("suppliers");
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.supplierFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function createPO(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    const items = poForm.product_ids
      .map((product_id) => ({
        product_id,
        quantity: poForm.quantities[product_id] || "1",
        unit_cost: poForm.unit_costs[product_id] || "0",
      }))
      .filter((i) => Number(i.quantity) > 0);
    if (!poForm.supplier_id || items.length === 0) {
      toast.error(t("inventory.poFailed"));
      return;
    }
    setBusy(true);
    try {
      await api("/inventory/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          supplier_id: poForm.supplier_id,
          items,
        }),
      });
      setModal(null);
      setPoForm({
        supplier_id: "",
        product_ids: [],
        quantities: {},
        unit_costs: {},
      });
      toast.success(t("inventory.poCreated"));
      setTab("pos");
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.poFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function attachSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!attachSupplierProductId || !attachSupplierId) return;
    setBusy(true);
    try {
      await api(`/products/${attachSupplierProductId}/suppliers`, {
        method: "POST",
        body: JSON.stringify({ supplier_id: attachSupplierId }),
      });
      toast.success(t("table.attachSupplier"));
      setAttachSupplierProductId(null);
      setAttachSupplierId(null);
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function receiveGRN(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    try {
      await api("/inventory/grn", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          purchase_order_id: grnForm.purchase_order_id,
          items: [
            {
              product_id: grnForm.product_id,
              quantity_received: grnForm.quantity_received,
            },
          ],
        }),
      });
      toast.success(t("inventory.grnReceived"));
      setGrnForm({ purchase_order_id: "", product_id: "", quantity_received: "" });
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.grnFailed"));
    }
  }

  async function createTransfer(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    if (!transferForm.to_branch_id) {
      toast.error(t("inventory.selectToBranch"));
      return;
    }
    if (transferForm.product_ids.length === 0) {
      toast.error(t("inventory.selectProducts"));
      return;
    }
    const items = transferForm.product_ids.map((product_id) => ({
      product_id,
      quantity: transferForm.quantities[product_id] || "1",
    }));
    setBusy(true);
    try {
      await api("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: session?.branch_id,
          to_branch_id: transferForm.to_branch_id,
          items,
        }),
      });
      toast.success(t("inventory.transferCreated"));
      setModal(null);
      setTransferForm({ to_branch_id: "", product_ids: [], quantities: {} });
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.transferFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmTransfer(id: string) {
    try {
      await api(`/inventory/transfers/${id}/confirm`, { method: "POST", body: "{}" });
      toast.success(t("inventory.transferConfirmed"));
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.confirmFailed"));
    }
  }

  async function adjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustForm.product_id) {
      toast.error(t("inventory.selectProduct"));
      return;
    }
    const session = getSession();
    try {
      await api("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          ...adjustForm,
        }),
      });
      toast.success(t("inventory.stockAdjusted"));
      setAdjustForm({ product_id: "", quantity_delta: "", reason_code: "adjustment" });
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.adjustFailed"));
    }
  }

  const tabs: { id: Tab; label: string; infoKey?: string }[] = [
    { id: "stock", label: t("inventory.tabs.stock"), infoKey: "tab.inventory.stock" },
    { id: "products", label: t("inventory.tabs.products"), infoKey: "tab.inventory.products" },
    { id: "suppliers", label: t("inventory.tabs.suppliers"), infoKey: "tab.inventory.suppliers" },
    { id: "pos", label: t("inventory.tabs.pos"), infoKey: "tab.inventory.pos" },
    { id: "transfers", label: t("inventory.tabs.transfers"), infoKey: "tab.inventory.transfers" },
    { id: "adjust", label: t("common.update"), infoKey: "tab.inventory.adjust" },
  ];

  const headerAction =
    tab === "products"
      ? { label: t("inventory.newProduct"), onClick: openNewProduct }
      : tab === "suppliers"
        ? { label: t("inventory.addSupplier"), onClick: openNewSupplier }
        : tab === "pos"
          ? { label: t("inventory.newPo"), onClick: () => setModal("po") }
          : tab === "transfers"
            ? {
                label: t("inventory.createTransfer"),
                onClick: () => {
                  setTransferForm({
                    to_branch_id: "",
                    product_ids: [],
                    quantities: {},
                  });
                  setModal("transfer");
                },
              }
            : undefined;

  const productCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    for (const c of categories) {
      if (c.name?.trim()) set.add(c.name.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, categories]);

  const productFilterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: false,
      categoryLabel: t("listFilters.categories"),
      categoryOptions: productCategoryOptions,
      statusOptions: [
        { value: "goods", label: "Goods" },
        { value: "service", label: "Service" },
      ],
    }),
    [productCategoryOptions, t]
  );

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("inventory.eyebrow")}
        title={t("pages.inventoryTitle")}
        description={t("pages.inventoryDesc")}
        infoKey="page.inventory"
        action={headerAction}
      />

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {tab === "stock" ? (
        <DataTable
          maxHeight="28rem"
          loading={stockLoading}
          filterState={stockFilters}
          onFilterChange={setStockFilters}
          clientFilter
          filterAccessors={{
            searchText: (row) => `${row.sku ?? ""} ${row.name ?? ""}`,
          }}
          searchPlaceholder={t("inventory.searchSku")}
          pagination={{ mode: "client", pageSize: 25 }}
          exportable
          exportFilename="stock"
          exportTitle="Stock"
          getExportRow={(row) => ({
            sku: row.sku ?? "",
            name: row.name ?? "",
            qty: row.quantity_on_hand,
            cost: row.avg_cost,
          })}
          exportColumns={[
            { key: "sku", header: "SKU" },
            { key: "name", header: "Name" },
            { key: "qty", header: "On hand" },
            { key: "cost", header: "Avg cost" },
          ]}
          columns={[
            {
              id: "sku",
              header: "SKU",
              cell: (row) => (
                <span className="font-medium tabular-nums text-heading">{row.sku}</span>
              ),
            },
            {
              id: "name",
              header: "Name",
              cell: (row) => row.name,
            },
            {
              id: "qty",
              header: "On hand",
              align: "right",
              cell: (row) => (
                <span className="tabular-nums font-semibold text-heading">
                  {row.quantity_on_hand}
                </span>
              ),
            },
            {
              id: "cost",
              header: "Avg cost",
              align: "right",
              cell: (row) => (
                <span className="tabular-nums text-body">{formatDecimal(row.avg_cost)}</span>
              ),
            },
          ]}
          data={stock}
          rowKey={(row) => row.product_id}
          emptyTitle="No stock rows"
          emptyBody="Add products and receive a GRN."
        />
      ) : null}

      {tab === "products" ? (
        <DataTable
          maxHeight="28rem"
          loading={productsLoading}
          filterState={productFilters}
          onFilterChange={setProductFilters}
          filterConfig={productFilterConfig}
          filterAccessors={{
            searchText: (p) =>
              `${p.name} ${p.sku} ${p.barcode || ""} ${p.brand || ""} ${p.category || ""}`,
            category: (p) => p.category || "",
            status: (p) => p.product_kind || "goods",
          }}
          clientFilter
          searchPlaceholder={t("inventory.searchProductsList")}
          pagination={{ mode: "client", pageSize: 25 }}
          exportable
          exportFilename="products"
          exportTitle="Products"
          getExportRow={(p) => ({
            sku: p.sku,
            name: p.name,
            kind: p.product_kind || "goods",
            unit: p.unit || "pcs",
            price: p.price ?? "",
          })}
          exportColumns={[
            { key: "sku", header: "SKU" },
            { key: "name", header: "Name" },
            { key: "kind", header: "Kind" },
            { key: "unit", header: "Unit" },
            { key: "price", header: "Price" },
          ]}
          onRowClick={(p) => router.push(detailRoutes.product(p.id))}
          columns={[
            {
              id: "thumb",
              header: "",
              width: 56,
              cell: (p) =>
                p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-9 w-9 rounded-md object-cover ring-1 ring-border"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-[10px] font-bold text-brand">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                ),
            },
            {
              id: "sku",
              header: "SKU / Barcode",
              cell: (p) => (
                <div>
                  <Link
                    href={detailRoutes.product(p.id)}
                    className="font-medium text-brand underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.sku}
                  </Link>
                  <div className="text-xs tabular-nums text-muted">
                    {p.barcode || "—"}
                  </div>
                </div>
              ),
            },
            {
              id: "name",
              header: "Name",
              cell: (p) => <span className="font-medium">{p.name}</span>,
            },
            {
              id: "kind",
              header: "Kind",
              cell: (p) => (
                <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold capitalize text-body">
                  {p.product_kind || "goods"}
                </span>
              ),
            },
            {
              id: "unit",
              header: "Unit",
              cell: (p) => (
                <span className="text-body">{p.unit || "pcs"}</span>
              ),
            },
            {
              id: "price",
              header: "Price",
              align: "right",
              cell: (p) => (
                <span className="tabular-nums font-semibold text-heading">
                  {p.price != null && p.price !== "" ? formatDecimal(p.price) : "—"}
                </span>
              ),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 56,
              cell: (p) => (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    items={[
                      {
                        id: "view",
                        label: "View",
                        onClick: () => router.push(detailRoutes.product(p.id)),
                      },
                      {
                        id: "edit",
                        label: "Edit",
                        onClick: () => openEditProduct(p),
                      },
                      {
                        id: "attach-supplier",
                        label: t("table.attachSupplier"),
                        onClick: () => {
                          setAttachSupplierProductId(p.id);
                          setAttachSupplierId(null);
                        },
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
          data={products}
          rowKey={(p) => p.id}
          emptyTitle="No products"
          emptyBody="Create a product to start stocking inventory."
        />
      ) : null}

      {tab === "suppliers" ? (
        <DataTable
          maxHeight="28rem"
          loading={suppliersLoading}
          searchable
          searchPlaceholder={t("inventory.searchSuppliers")}
          getSearchText={(s) =>
            [
              s.name,
              s.legal_name,
              s.code,
              s.city,
              s.contact_name,
              s.contact_email,
              s.industry,
              ...(s.catalogs || []),
              ...(s.brands || []),
              ...(s.tags || []),
            ]
              .filter(Boolean)
              .join(" ")
          }
          onRowClick={(s) => router.push(detailRoutes.supplier(s.id))}
          columns={[
            {
              id: "name",
              header: "Company",
              cell: (s) => (
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={detailRoutes.supplier(s.id)}
                      className="font-medium text-brand underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.name}
                    </Link>
                    {s.is_preferred ? (
                      <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">
                        Preferred
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted">
                    {s.code || "—"}
                    {s.legal_name ? ` · ${s.legal_name}` : ""}
                  </div>
                </div>
              ),
            },
            {
              id: "contact",
              header: "Contact person",
              cell: (s) => (
                <div>
                  <div className="font-medium">{s.contact_name || "—"}</div>
                  <div className="text-xs text-muted">
                    {[s.contact_role, s.contact_phone || s.contact_mobile]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              ),
            },
            {
              id: "location",
              header: "Location",
              cell: (s) => (
                <span className="text-body">
                  {[s.city, s.province].filter(Boolean).join(", ") || "—"}
                </span>
              ),
            },
            {
              id: "catalogs",
              header: "Catalogs",
              cell: (s) => (
                <div className="flex max-w-[220px] flex-wrap gap-1">
                  {(s.catalogs || []).slice(0, 4).map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-semibold capitalize text-body"
                    >
                      {c}
                    </span>
                  ))}
                  {(s.catalogs || []).length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : null}
                </div>
              ),
            },
            {
              id: "terms",
              header: "Terms",
              cell: (s) => (
                <span className="text-sm text-body">{s.payment_terms || "—"}</span>
              ),
            },
            {
              id: "status",
              header: "Status",
              cell: (s) => (
                <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold capitalize">
                  {s.status || "active"}
                </span>
              ),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 56,
              cell: (s) => (
                <div className="flex justify-end">
                  <ActionMenu
                    items={[
                      {
                        id: "view",
                        label: "View",
                        onClick: () => router.push(detailRoutes.supplier(s.id)),
                      },
                      {
                        id: "edit",
                        label: "Edit",
                        onClick: () => openEditSupplier(s),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
          data={suppliers}
          rowKey={(s) => s.id}
          emptyTitle="No suppliers"
          emptyBody="Add a supplier to raise purchase orders."
        />
      ) : null}

      {tab === "pos" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="p-5">
            <h2 className="font-semibold text-heading">Receive GRN</h2>
            <form onSubmit={receiveGRN} className="mt-4 space-y-3">
              <Select
                value={grnForm.purchase_order_id}
                onChange={(v) => {
                  const po = pos.find((p) => p.id === v);
                  setGrnForm({
                    purchase_order_id: v,
                    product_id: po?.items[0]?.product_id || "",
                    quantity_received: po?.items[0]?.quantity || "",
                  });
                }}
                required
                placeholder="Purchase order"
                options={[
                  { value: "", label: "Purchase order" },
                  ...pos
                    .filter((p) => p.status !== "received" && p.status !== "cancelled")
                    .map((p) => ({
                      value: p.id,
                      label: `${p.supplier_name || p.id.slice(0, 8)} · ${p.status}`,
                    })),
                ]}
              />
              <input
                className={fieldClass}
                placeholder="Qty received"
                value={grnForm.quantity_received}
                onChange={(e) =>
                  setGrnForm({ ...grnForm, quantity_received: e.target.value })
                }
                required
              />
              <Button type="submit">Receive</Button>
            </form>
          </SurfaceCard>

          <DataTable
            maxHeight="20rem"
            loading={posLoading}
            searchable
            searchPlaceholder={t("inventory.searchPos")}
            getSearchText={(p) =>
              `${p.supplier_name ?? ""} ${p.supplier_id} ${p.status}`
            }
            onRowClick={(p) => router.push(detailRoutes.purchaseOrder(p.id))}
            columns={[
              {
                id: "supplier",
                header: "Supplier",
                cell: (p) => (
                  <Link
                    href={detailRoutes.purchaseOrder(p.id)}
                    className="font-medium text-brand underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.supplier_name || p.supplier_id.slice(0, 8)}
                  </Link>
                ),
              },
              {
                id: "status",
                header: "Status",
                cell: (p) => (
                  <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold capitalize text-body">
                    {p.status}
                  </span>
                ),
              },
              {
                id: "lines",
                header: "Lines",
                align: "right",
                cell: (p) => (
                  <span className="tabular-nums">{p.items?.length || 0}</span>
                ),
              },
            ]}
            data={pos}
            rowKey={(p) => p.id}
            emptyTitle="No purchase orders"
            emptyBody="Create a PO to start receiving stock."
          />
        </div>
      ) : null}

      {tab === "transfers" ? (
        <DataTable
          maxHeight="28rem"
          loading={transfersLoading}
          filterState={transferFilters}
          onFilterChange={setTransferFilters}
          clientFilter
          filterConfig={{
            statusOptions: [
              { value: "pending", label: t("inventory.statusPending") },
              { value: "confirmed", label: t("inventory.statusConfirmed") },
            ],
          }}
          filterAccessors={{
            searchText: (tr) => {
              const names = (tr.items || [])
                .map(
                  (i) =>
                    products.find((p) => p.id === i.product_id)?.name ||
                    i.product_id
                )
                .join(", ");
              const qty = (tr.items || []).map((i) => i.quantity).join(", ");
              return `${tr.status} ${names} ${qty}`;
            },
            status: (tr) => tr.status,
            date: (tr) => tr.inserted_at,
          }}
          searchPlaceholder={t("inventory.searchTransfers")}
          pagination={{ mode: "client", pageSize: 25 }}
          exportable
          exportFilename="transfers"
          exportTitle={t("inventory.tabs.transfers")}
          getExportRow={(tr) => {
            const names = (tr.items || [])
              .map(
                (i) =>
                  products.find((p) => p.id === i.product_id)?.name ||
                  i.product_id
              )
              .join(", ");
            const qty = (tr.items || []).map((i) => i.quantity).join(", ");
            return {
              status: tr.status,
              products: names,
              qty,
              when: tr.inserted_at ? formatLocalDateTime(tr.inserted_at) : "",
            };
          }}
          exportColumns={[
            { key: "status", header: t("common.status") },
            { key: "products", header: t("inventory.products") },
            { key: "qty", header: t("common.quantity") },
            { key: "when", header: t("common.date") },
          ]}
          columns={[
            {
              id: "status",
              header: t("common.status"),
              cell: (tr) => (
                <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold capitalize">
                  {tr.status}
                </span>
              ),
            },
            {
              id: "summary",
              header: t("inventory.products"),
              cell: (tr) => {
                const names = (tr.items || [])
                  .map(
                    (i) =>
                      products.find((p) => p.id === i.product_id)?.name ||
                      i.product_id
                  )
                  .join(", ");
                return (
                  <span className="line-clamp-2 text-sm text-heading">
                    {names || "—"}
                  </span>
                );
              },
            },
            {
              id: "qty",
              header: t("common.quantity"),
              align: "right",
              cell: (tr) => (
                <span className="tabular-nums">
                  {(tr.items || []).map((i) => i.quantity).join(", ") || "—"}
                </span>
              ),
            },
            {
              id: "when",
              header: t("common.date"),
              cell: (tr) =>
                tr.inserted_at ? formatLocalDateTime(tr.inserted_at) : "—",
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 110,
              cell: (tr) =>
                tr.status === "pending" ? (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" onClick={() => confirmTransfer(tr.id)}>
                      {t("inventory.confirm")}
                    </Button>
                  </div>
                ) : null,
            },
          ]}
          data={transfers}
          rowKey={(tr) => tr.id}
          emptyTitle={t("inventory.noTransfers")}
          emptyBody={t("inventory.noTransfersBody")}
        />
      ) : null}

      {tab === "adjust" ? (
        <SurfaceCard className="max-w-xl p-5">
          <form onSubmit={adjustStock} className="space-y-3">
            <SearchSelect
              label={t("inventory.product")}
              options={productOptions}
              value={adjustForm.product_id || null}
              onChange={(product_id) =>
                setAdjustForm((f) => ({ ...f, product_id: product_id || "" }))
              }
              placeholder={t("inventory.selectProduct")}
              searchPlaceholder={t("searchSelect.search")}
            />
            <input
              className={fieldClass}
              placeholder="Qty delta (e.g. -2 or 5)"
              value={adjustForm.quantity_delta}
              onChange={(e) =>
                setAdjustForm({ ...adjustForm, quantity_delta: e.target.value })
              }
              required
            />
            <Select
              value={adjustForm.reason_code}
              onChange={(v) => setAdjustForm({ ...adjustForm, reason_code: v })}
              options={[
                "adjustment",
                "damage",
                "theft",
                "count_correction",
                "expired",
                "sample",
              ].map((r) => ({ value: r, label: r }))}
            />
            <Button type="submit">Apply adjustment</Button>
          </form>
        </SurfaceCard>
      ) : null}

      <Modal
        isOpen={modal === "product"}
        onClose={closeProductModal}
        title={editingProductId ? "Edit product" : "New product"}
        description={
          editingProductId
            ? "Update catalog details and branch price for the active branch."
            : "Works for retail, restaurant, salon, pharmacy, and general shops. Add barcode and photo for faster POS."
        }
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeProductModal}>
              Cancel
            </Button>
            <Button type="submit" form="product-modal-form" loading={busy}>
              {editingProductId ? "Save changes" : "Create product"}
            </Button>
          </div>
        }
      >
        <form id="product-modal-form" onSubmit={saveProduct} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU">
              <input
                className={fieldClass}
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                required
              />
            </Field>
            <Field label={t("inventory.barcode")}>
              <div className="flex gap-2">
                <input
                  className={`${fieldClass} min-w-0 flex-1`}
                  value={productForm.barcode}
                  onChange={(e) =>
                    setProductForm({ ...productForm, barcode: e.target.value })
                  }
                  placeholder={t("inventory.barcodePlaceholder")}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() =>
                    setProductForm({ ...productForm, barcode: generateBarcode() })
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
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Kind">
              <Select
                value={productForm.product_kind}
                onChange={(v) =>
                  setProductForm({ ...productForm, product_kind: v })
                }
                options={[
                  { value: "goods", label: "Goods" },
                  { value: "service", label: "Service" },
                  { value: "combo", label: "Combo" },
                ]}
              />
            </Field>
            <Field label="Unit">
              <Select
                value={productForm.unit}
                onChange={(v) => setProductForm({ ...productForm, unit: v })}
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
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                onBlur={(e) => {
                  if (e.target.value.trim() === "") return;
                  setProductForm({ ...productForm, price: formatDecimal(e.target.value) });
                }}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <input
                className={fieldClass}
                value={productForm.brand}
                onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <Select
                value={productForm.category_id}
                onChange={(v) => {
                  const cat = categories.find((c) => c.id === v);
                  setProductForm({
                    ...productForm,
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
          {productForm.product_kind === "service" ? (
            <Field label="Duration (minutes)">
              <input
                className={fieldClass}
                value={productForm.duration_minutes}
                onChange={(e) =>
                  setProductForm({ ...productForm, duration_minutes: e.target.value })
                }
                placeholder="e.g. 45"
              />
            </Field>
          ) : null}
          <Field label="Product image">
            <input
              type="file"
              accept="image/*"
              className={fieldClass}
              onChange={(e) => setProductImage(e.target.files?.[0] || null)}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        isOpen={modal === "supplier"}
        onClose={closeSupplierModal}
        title={editingSupplierId ? "Edit supplier" : "Add supplier"}
        description="Company details, liaison contact, address, payment terms, and product catalogs."
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeSupplierModal}>
              Cancel
            </Button>
            <Button type="submit" form="supplier-modal-form" loading={busy}>
              {editingSupplierId ? "Save changes" : "Add supplier"}
            </Button>
          </div>
        }
      >
        <form id="supplier-modal-form" onSubmit={saveSupplier} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Company</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Trade name">
                <input
                  className={fieldClass}
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Legal name">
                <input
                  className={fieldClass}
                  value={supplierForm.legal_name}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, legal_name: e.target.value })
                  }
                />
              </Field>
              <Field label="Supplier code">
                <input
                  className={fieldClass}
                  value={supplierForm.code}
                  onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                  placeholder="e.g. LHR-DIST"
                />
              </Field>
              <Field label="Industry">
                <input
                  className={fieldClass}
                  value={supplierForm.industry}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, industry: e.target.value })
                  }
                  placeholder="FMCG wholesale"
                />
              </Field>
              <Field label="NTN / Tax ID">
                <input
                  className={fieldClass}
                  value={supplierForm.tax_id}
                  onChange={(e) => setSupplierForm({ ...supplierForm, tax_id: e.target.value })}
                />
              </Field>
              <Field label="STRN">
                <input
                  className={fieldClass}
                  value={supplierForm.strn}
                  onChange={(e) => setSupplierForm({ ...supplierForm, strn: e.target.value })}
                />
              </Field>
              <Field label="Website">
                <input
                  className={fieldClass}
                  value={supplierForm.website}
                  onChange={(e) => setSupplierForm({ ...supplierForm, website: e.target.value })}
                  placeholder="https://"
                />
              </Field>
              <Field label="Status">
                <Select
                  value={supplierForm.status}
                  onChange={(v) => setSupplierForm({ ...supplierForm, status: v })}
                  options={["active", "inactive", "blocked", "pending"].map((s) => ({
                    value: s,
                    label: s,
                  }))}
                />
              </Field>
              <Field label="Rating (1–5)">
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  max={5}
                  value={supplierForm.rating}
                  onChange={(e) => setSupplierForm({ ...supplierForm, rating: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 pt-7 text-sm text-heading">
                <input
                  type="checkbox"
                  checked={supplierForm.is_preferred}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, is_preferred: e.target.checked })
                  }
                />
                Preferred supplier
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              Primary contact
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Person name">
                <input
                  className={fieldClass}
                  value={supplierForm.contact_name}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contact_name: e.target.value })
                  }
                />
              </Field>
              <Field label="Role / title">
                <input
                  className={fieldClass}
                  value={supplierForm.contact_role}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contact_role: e.target.value })
                  }
                  placeholder="Key Account Manager"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={fieldClass}
                  value={supplierForm.contact_email}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contact_email: e.target.value })
                  }
                />
              </Field>
              <Field label="Phone">
                <input
                  className={fieldClass}
                  value={supplierForm.contact_phone}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contact_phone: e.target.value })
                  }
                />
              </Field>
              <Field label="Mobile">
                <input
                  className={fieldClass}
                  value={supplierForm.contact_mobile}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contact_mobile: e.target.value })
                  }
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  className={fieldClass}
                  value={supplierForm.contact_whatsapp}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contact_whatsapp: e.target.value })
                  }
                />
              </Field>
              <Field label="CNIC">
                <input
                  className={fieldClass}
                  value={supplierForm.contact_cnic}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contact_cnic: e.target.value })
                  }
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Address</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Address line 1">
                <input
                  className={fieldClass}
                  value={supplierForm.address_line1}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, address_line1: e.target.value })
                  }
                />
              </Field>
              <Field label="Address line 2">
                <input
                  className={fieldClass}
                  value={supplierForm.address_line2}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, address_line2: e.target.value })
                  }
                />
              </Field>
              <Field label="City">
                <input
                  className={fieldClass}
                  value={supplierForm.city}
                  onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                />
              </Field>
              <Field label="Province">
                <input
                  className={fieldClass}
                  value={supplierForm.province}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, province: e.target.value })
                  }
                />
              </Field>
              <Field label="Postal code">
                <input
                  className={fieldClass}
                  value={supplierForm.postal_code}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, postal_code: e.target.value })
                  }
                />
              </Field>
              <Field label="Country">
                <input
                  className={fieldClass}
                  value={supplierForm.country}
                  onChange={(e) => setSupplierForm({ ...supplierForm, country: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              Payment & credit
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment terms">
                <input
                  className={fieldClass}
                  value={supplierForm.payment_terms}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, payment_terms: e.target.value })
                  }
                  placeholder="Net 30"
                />
              </Field>
              <Field label="Payment method">
                <Select
                  value={supplierForm.payment_method}
                  onChange={(v) =>
                    setSupplierForm({ ...supplierForm, payment_method: v })
                  }
                  options={["bank_transfer", "cash", "cheque", "wallet", "credit"].map(
                    (m) => ({ value: m, label: m.replace("_", " ") })
                  )}
                />
              </Field>
              <Field label="Bank name">
                <input
                  className={fieldClass}
                  value={supplierForm.bank_name}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, bank_name: e.target.value })
                  }
                />
              </Field>
              <Field label="IBAN">
                <input
                  className={fieldClass}
                  value={supplierForm.bank_iban}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, bank_iban: e.target.value })
                  }
                />
              </Field>
              <Field label="Account title">
                <input
                  className={fieldClass}
                  value={supplierForm.bank_account_title}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, bank_account_title: e.target.value })
                  }
                />
              </Field>
              <Field label="Credit limit">
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  value={supplierForm.credit_limit}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, credit_limit: e.target.value })
                  }
                  onBlur={(e) => {
                    if (e.target.value.trim() === "") return;
                    setSupplierForm({
                      ...supplierForm,
                      credit_limit: formatDecimal(e.target.value),
                    });
                  }}
                />
              </Field>
              <Field label="Currency">
                <input
                  className={fieldClass}
                  value={supplierForm.currency}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, currency: e.target.value })
                  }
                />
              </Field>
              <Field label="Lead time (days)">
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  value={supplierForm.lead_time_days}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, lead_time_days: e.target.value })
                  }
                />
              </Field>
              <Field label="Minimum order amount">
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  value={supplierForm.minimum_order_amount}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      minimum_order_amount: e.target.value,
                    })
                  }
                  onBlur={(e) => {
                    if (e.target.value.trim() === "") return;
                    setSupplierForm({
                      ...supplierForm,
                      minimum_order_amount: formatDecimal(e.target.value),
                    });
                  }}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              Catalogs & brands
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Catalogs (comma-separated)">
                <input
                  className={fieldClass}
                  value={supplierForm.catalogs}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, catalogs: e.target.value })
                  }
                  placeholder="beverages, snacks, dairy"
                />
              </Field>
              <Field label="Brands (comma-separated)">
                <input
                  className={fieldClass}
                  value={supplierForm.brands}
                  onChange={(e) => setSupplierForm({ ...supplierForm, brands: e.target.value })}
                  placeholder="Nestle, Pepsi"
                />
              </Field>
              <Field label="Tags (comma-separated)">
                <input
                  className={fieldClass}
                  value={supplierForm.tags}
                  onChange={(e) => setSupplierForm({ ...supplierForm, tags: e.target.value })}
                  placeholder="preferred, fmcg"
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                className={fieldClass}
                rows={3}
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              />
            </Field>
          </section>
        </form>
      </Modal>

      <Modal
        isOpen={modal === "po"}
        onClose={() => setModal(null)}
        title={t("inventory.newPoTitle")}
        description={t("inventory.poModalDesc")}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="po-modal-form" loading={busy}>
              {t("inventory.createPo")}
            </Button>
          </div>
        }
      >
        <form id="po-modal-form" onSubmit={createPO} className="space-y-5">
          <SearchSelect
            label={t("inventory.supplier")}
            options={supplierOptions}
            value={poForm.supplier_id || null}
            onChange={(supplier_id) =>
              setPoForm((f) => ({ ...f, supplier_id: supplier_id || "" }))
            }
            placeholder={t("inventory.selectSupplier")}
            searchPlaceholder={t("searchSelect.search")}
          />
          <SearchMultiSelect
            label={t("inventory.products")}
            options={productOptions}
            value={poForm.product_ids}
            onChange={(product_ids) =>
              setPoForm((f) => ({
                ...f,
                product_ids,
                quantities: Object.fromEntries(
                  product_ids.map((id) => [id, f.quantities[id] || "10"])
                ),
                unit_costs: Object.fromEntries(
                  product_ids.map((id) => [id, f.unit_costs[id] || "50"])
                ),
              }))
            }
            placeholder={t("pos.searchProducts")}
            searchPlaceholder={t("searchSelect.search")}
          />
          {poForm.product_ids.length > 0 ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {t("inventory.quantities")}
              </p>
              {poForm.product_ids.map((id) => {
                const p = products.find((x) => x.id === id);
                return (
                  <div key={id} className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem]">
                    <p className="text-sm font-medium text-heading">
                      {p?.name || id}
                    </p>
                    <Field label={t("common.quantity")}>
                      <input
                        className={fieldClass}
                        value={poForm.quantities[id] || ""}
                        onChange={(e) =>
                          setPoForm((f) => ({
                            ...f,
                            quantities: {
                              ...f.quantities,
                              [id]: e.target.value,
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label={t("inventory.unitCost")}>
                      <input
                        className={fieldClass}
                        type="number"
                        step="0.01"
                        value={poForm.unit_costs[id] || ""}
                        onChange={(e) =>
                          setPoForm((f) => ({
                            ...f,
                            unit_costs: {
                              ...f.unit_costs,
                              [id]: e.target.value,
                            },
                          }))
                        }
                        onBlur={(e) => {
                          if (e.target.value.trim() === "") return;
                          const v = formatDecimal(e.target.value);
                          setPoForm((f) => ({
                            ...f,
                            unit_costs: { ...f.unit_costs, [id]: v },
                          }));
                        }}
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        isOpen={!!attachSupplierProductId}
        onClose={() => {
          setAttachSupplierProductId(null);
          setAttachSupplierId(null);
        }}
        title={t("table.attachSupplier")}
        description={t("table.suppliersAttached")}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setAttachSupplierProductId(null);
                setAttachSupplierId(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="attach-supplier-form" loading={busy}>
              {t("table.attachSupplier")}
            </Button>
          </div>
        }
      >
        <form id="attach-supplier-form" onSubmit={attachSupplier} className="space-y-4">
          <SearchSelect
            label={t("inventory.supplier")}
            options={supplierOptions}
            value={attachSupplierId}
            onChange={setAttachSupplierId}
            placeholder={t("inventory.selectSupplier")}
            searchPlaceholder={t("searchSelect.search")}
          />
        </form>
      </Modal>

      <Modal
        isOpen={modal === "transfer"}
        onClose={() => setModal(null)}
        title={t("inventory.transferModalTitle")}
        description={t("inventory.transferModalDesc")}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="transfer-modal-form" loading={busy}>
              {t("inventory.createTransfer")}
            </Button>
          </div>
        }
      >
        <form id="transfer-modal-form" onSubmit={createTransfer} className="space-y-5">
          <SearchSelect
            label={t("inventory.toBranch")}
            options={branchOptions}
            value={transferForm.to_branch_id || null}
            onChange={(to_branch_id) =>
              setTransferForm((f) => ({ ...f, to_branch_id: to_branch_id || "" }))
            }
            placeholder={t("inventory.selectToBranch")}
            searchPlaceholder={t("searchSelect.search")}
          />
          <SearchMultiSelect
            label={t("inventory.products")}
            options={productOptions}
            value={transferForm.product_ids}
            onChange={(product_ids) =>
              setTransferForm((f) => {
                const quantities = { ...f.quantities };
                for (const id of product_ids) {
                  if (!quantities[id]) quantities[id] = "1";
                }
                return { ...f, product_ids, quantities };
              })
            }
            placeholder={t("inventory.selectProducts")}
            searchPlaceholder={t("searchSelect.search")}
          />
          {transferForm.product_ids.length > 0 ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {t("inventory.quantities")}
              </p>
              {transferForm.product_ids.map((id) => {
                const p = products.find((x) => x.id === id);
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-heading">
                      {p?.name || id}
                    </span>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      className={`${fieldClass} w-28`}
                      value={transferForm.quantities[id] || "1"}
                      onChange={(e) =>
                        setTransferForm((f) => ({
                          ...f,
                          quantities: { ...f.quantities, [id]: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
