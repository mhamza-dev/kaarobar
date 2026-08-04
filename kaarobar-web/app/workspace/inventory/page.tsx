"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Check,
  PackagePlus,
  Plus,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { api, apiAllPages, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import {
  SurfaceCard,
  formStackClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import { useTabQueryParam } from "@/lib/hooks/useTabQueryParam";
import { detailRoutes, routes } from "@/lib/navigation";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";
import { formatLocalDateTime } from "@/lib/datetime";
import { inventoryKeys } from "@/lib/queryClient";
import ProductFormModal from "@/components/inventory/ProductFormModal";
import SupplierFormModal from "@/components/inventory/SupplierFormModal";
import {
  AdjustStockFormFields,
  AttachSupplierFormFields,
  GrnFormFields,
  PurchaseOrderFormFields,
  TransferFormFields,
  emptyAdjustStockForm,
  emptyAttachSupplierForm,
  emptyGrnForm,
  emptyPurchaseOrderForm,
  emptyTransferForm,
} from "@/components/inventory/InventoryModalForms";
import CustomForm from "@/components/ui/CustomForm";
import {
  adjustStockFormSchema,
  attachSupplierFormSchema,
  grnFormSchema,
  purchaseOrderFormSchema,
  transferFormSchema,
  type AdjustStockFormValues,
  type AttachSupplierFormValues,
  type GrnFormValues,
  type PurchaseOrderFormValues,
  type TransferFormValues,
} from "@/lib/validations/inventory";
import WorkspacePageScaffold from "@/components/app/WorkspacePageScaffold";
import FormModal from "@/components/app/FormModal";
import DateAndTime from "@/components/app/DateAndTime";

type Tab = "stock" | "products" | "suppliers" | "pos" | "transfers" | "adjust";
const INVENTORY_TABS: readonly Tab[] = [
  "stock",
  "products",
  "suppliers",
  "pos",
  "transfers",
  "adjust",
];
type ModalKind = "product" | "supplier" | "po" | "transfer" | "grn" | null;

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
  tags?: string[];
};

type PO = {
  id: string;
  status: string;
  supplier_name?: string;
  supplier_id: string;
  items: {
    product_id: string;
    product_name?: string;
    product_sku?: string;
    quantity: string;
    unit_cost: string;
  }[];
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [busy, setBusy] = useState(false);

  const [productFilters, setProductFilters] = useState<StaffListFilterState>(
    emptyStaffListFilters()
  );
  const [stockFilters, setStockFilters] = useState(emptyStaffListFilters);
  const [transferFilters, setTransferFilters] = useState(emptyStaffListFilters);
  const [poInitial, setPoInitial] = useState(() => emptyPurchaseOrderForm());
  const [attachSupplierProductId, setAttachSupplierProductId] = useState<
    string | null
  >(null);
  const [attachSupplierInitial, setAttachSupplierInitial] = useState(() =>
    emptyAttachSupplierForm()
  );
  const [grnInitial, setGrnInitial] = useState(() => emptyGrnForm());
  const [poSupplierProducts, setPoSupplierProducts] = useState<Product[]>([]);
  const [poSupplierProductsLoading, setPoSupplierProductsLoading] = useState(false);
  const [transferInitial, setTransferInitial] = useState(() => emptyTransferForm());
  const [adjustInitial, setAdjustInitial] = useState(() => emptyAdjustStockForm());

  const needProducts =
    tab === "products" || tab === "pos" || tab === "transfers" || tab === "adjust";
  const needSuppliers =
    tab === "suppliers" || tab === "pos" || !!attachSupplierProductId || modal === "po";

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: inventoryKeys.products(businessId),
    queryFn: async () => apiAllPages<Product>("/products"),
    enabled: needProducts,
  });

  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: inventoryKeys.stock(businessId),
    queryFn: async () => {
      try {
        return await apiAllPages<StockRow>("/inventory");
      } catch {
        return [] as StockRow[];
      }
    },
    enabled: tab === "stock",
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: inventoryKeys.suppliers(businessId),
    queryFn: async () => {
      try {
        return await apiAllPages<Supplier>("/suppliers");
      } catch {
        return [] as Supplier[];
      }
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
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.name || p.id,
        meta: p.sku || undefined,
      })),
    [products]
  );

  const transferProductMetaById = useMemo(() => {
    const byId = new Map<string, { name: string; sku?: string }>();
    for (const p of products) {
      byId.set(p.id, { name: p.name || p.id, sku: p.sku || undefined });
    }
    for (const opt of productOptions) {
      if (!byId.has(opt.value)) {
        byId.set(opt.value, { name: opt.label || opt.value, sku: opt.meta || undefined });
      }
    }
    return byId;
  }, [products, productOptions]);

  function openNewProduct() {
    setEditingProduct(null);
    setModal("product");
  }

  function openEditProduct(p: Product) {
    setEditingProduct(p);
    setModal("product");
  }

  function closeProductModal() {
    setModal(null);
    setEditingProduct(null);
  }

  function openNewSupplier() {
    setEditingSupplier(null);
    setModal("supplier");
  }

  function openEditSupplier(s: Supplier) {
    setEditingSupplier(s);
    setModal("supplier");
  }

  function closeSupplierModal() {
    setModal(null);
    setEditingSupplier(null);
  }

  async function createPO(form: PurchaseOrderFormValues) {
    const session = getSession();
    const items = form.product_ids
      .map((product_id) => ({
        product_id,
        quantity: form.quantities[product_id] || "1",
        unit_cost: form.unit_costs[product_id] || "0",
      }))
      .filter((i) => Number(i.quantity) > 0);
    if (!form.supplier_id || items.length === 0) {
      toast.error(t("inventory.poFailed"));
      return;
    }
    setBusy(true);
    try {
      await api("/inventory/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          supplier_id: form.supplier_id,
          items,
        }),
      });
      setModal(null);
      setPoInitial(emptyPurchaseOrderForm());
      toast.success(t("inventory.poCreated"));
      setTab("pos");
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.poFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function attachSupplier(form: AttachSupplierFormValues) {
    if (!attachSupplierProductId || !form.supplier_id) return;
    setBusy(true);
    try {
      await api(`/products/${attachSupplierProductId}/suppliers`, {
        method: "POST",
        body: JSON.stringify({ supplier_id: form.supplier_id }),
      });
      toast.success(t("table.attachSupplier"));
      setAttachSupplierProductId(null);
      setAttachSupplierInitial(emptyAttachSupplierForm());
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function receiveGRN(form: GrnFormValues) {
    const session = getSession();
    const po = pos.find((p) => p.id === form.purchase_order_id);
    const items = (po?.items || [])
      .map((item) => ({
        product_id: item.product_id,
        quantity_received: form.quantities[item.product_id] || "0",
      }))
      .filter((i) => Number(i.quantity_received) > 0);
    if (!form.purchase_order_id || items.length === 0) {
      toast.error(t("inventory.grnFailed"));
      return;
    }
    setBusy(true);
    try {
      await api("/inventory/grn", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          purchase_order_id: form.purchase_order_id,
          items,
        }),
      });
      toast.success(t("inventory.grnReceived"));
      setGrnInitial(emptyGrnForm());
      setModal(null);
      await refreshInventory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.grnFailed"));
    } finally {
      setBusy(false);
    }
  }

  function openGrnModal(poId?: string) {
    const po = poId ? pos.find((p) => p.id === poId) : undefined;
    const quantities: Record<string, string> = {};
    for (const item of po?.items || []) {
      quantities[item.product_id] = item.quantity || "0";
    }
    setGrnInitial({
      purchase_order_id: poId || "",
      quantities,
    });
    setModal("grn");
  }

  async function loadPoSupplierProducts(supplierId: string) {
    if (!supplierId) {
      setPoSupplierProducts([]);
      return;
    }
    setPoSupplierProductsLoading(true);
    try {
      const res = await api<{ data: Product[] }>(`/suppliers/${supplierId}/products`);
      setPoSupplierProducts(res.data || []);
    } catch (err) {
      setPoSupplierProducts([]);
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPoSupplierProductsLoading(false);
    }
  }

  async function createTransfer(form: TransferFormValues) {
    const session = getSession();
    if (!form.to_branch_id) {
      toast.error(t("inventory.selectToBranch"));
      return;
    }
    if (form.product_ids.length === 0) {
      toast.error(t("inventory.selectProducts"));
      return;
    }
    const items = form.product_ids.map((product_id) => ({
      product_id,
      quantity: form.quantities[product_id] || "1",
    }));
    setBusy(true);
    try {
      await api("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: session?.branch_id,
          to_branch_id: form.to_branch_id,
          items,
        }),
      });
      toast.success(t("inventory.transferCreated"));
      setModal(null);
      setTransferInitial(emptyTransferForm());
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

  async function adjustStock(form: AdjustStockFormValues) {
    if (!form.product_id) {
      toast.error(t("inventory.selectProduct"));
      return;
    }
    const session = getSession();
    try {
      await api("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          ...form,
        }),
      });
      toast.success(t("inventory.stockAdjusted"));
      setAdjustInitial(emptyAdjustStockForm());
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
      ? {
          label: t("inventory.newProduct"),
          onClick: openNewProduct,
          icon: <PackagePlus className="h-4 w-4" />,
        }
      : tab === "suppliers"
        ? {
            label: t("inventory.addSupplier"),
            onClick: openNewSupplier,
            icon: <Plus className="h-4 w-4" />,
          }
        : tab === "pos"
          ? {
              label: t("inventory.newPo"),
              onClick: () => {
                setPoInitial(emptyPurchaseOrderForm());
                setPoSupplierProducts([]);
                setModal("po");
              },
              icon: <Truck className="h-4 w-4" />,
            }
          : tab === "transfers"
            ? {
                label: t("inventory.createTransfer"),
                onClick: () => {
                  setTransferInitial(emptyTransferForm());
                  setModal("transfer");
                },
                icon: <ArrowLeftRight className="h-4 w-4" />,
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

  const poProductOptions = useMemo(
    () =>
      poSupplierProducts.map((p) => ({
        value: p.id,
        label: p.sku ? `${p.name} (${p.sku})` : p.name,
      })),
    [poSupplierProducts]
  );

  const openPos = useMemo(
    () => pos.filter((p) => p.status !== "received" && p.status !== "cancelled"),
    [pos]
  );

  return (
    <WorkspacePageScaffold
      header={{
        eyebrow: t("inventory.eyebrow"),
        title: t("pages.inventoryTitle"),
        description: t("pages.inventoryDesc"),
        infoKey: "page.inventory",
        action: headerAction,
        secondaryAction:
          tab === "pos"
            ? {
                label: t("inventory.receiveGrn"),
                onClick: () => openGrnModal(),
                icon: <Check className="h-4 w-4" />,
              }
            : undefined,
      }}
      tabs={{ tabs, value: tab, onChange: setTab }}
    >

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
          pagination={{ mode: "client", pageSize: 20 }}
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
          pagination={{ mode: "client", pageSize: 20 }}
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
              width: 88,
              cell: (p) => (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    items={[
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
                          setAttachSupplierInitial(emptyAttachSupplierForm());
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
              width: 48,
              cell: (s) => (
                <div className="flex justify-end">
                  <ActionMenu
                    items={[
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
        <DataTable
          maxHeight="28rem"
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
              header: t("inventory.supplier"),
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
              header: t("common.status"),
              cell: (p) => (
                <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold capitalize text-body">
                  {p.status}
                </span>
              ),
            },
            {
              id: "lines",
              header: t("inventory.products"),
              align: "right",
              cell: (p) => (
                <span className="tabular-nums">{p.items?.length || 0}</span>
              ),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 48,
              cell: (p) =>
                p.status !== "received" && p.status !== "cancelled" ? (
                  <div className="flex justify-end">
                    <ActionMenu
                      items={[
                        {
                          id: "receive",
                          label: t("inventory.receiveGrn"),
                          onClick: () => openGrnModal(p.id),
                        },
                      ]}
                    />
                  </div>
                ) : null,
            },
          ]}
          data={pos}
          rowKey={(p) => p.id}
          emptyTitle="No purchase orders"
          emptyBody="Create a PO to start receiving stock."
        />
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
          pagination={{ mode: "client", pageSize: 20 }}
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
              cell: (tr) => <DateAndTime value={tr.inserted_at} />,
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 110,
              cell: (tr) =>
                tr.status === "pending" ? (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      onClick={() => confirmTransfer(tr.id)}
                      startIcon={<Check className="h-4 w-4" />}
                    >
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
          <CustomForm
            className={formStackClass}
            initialValues={adjustInitial}
            validationSchema={adjustStockFormSchema}
            onSubmit={adjustStock}
          >
            {() => (
              <>
                <AdjustStockFormFields productOptions={productOptions} t={t} />
                <Button type="submit" startIcon={<SlidersHorizontal className="h-4 w-4" />}>
                  Apply adjustment
                </Button>
              </>
            )}
          </CustomForm>
        </SurfaceCard>
      ) : null}

      <ProductFormModal
        isOpen={modal === "product"}
        onClose={closeProductModal}
        product={editingProduct}
        onSuccess={async () => {
          setTab("products");
          await refreshInventory();
        }}
      />

      <SupplierFormModal
        isOpen={modal === "supplier"}
        onClose={closeSupplierModal}
        supplier={editingSupplier}
        onSuccess={async () => {
          setTab("suppliers");
          await refreshInventory();
        }}
      />

      <FormModal
        isOpen={modal === "po"}
        onClose={() => setModal(null)}
        title={t("inventory.newPoTitle")}
        description={t("inventory.poModalDesc")}
        size="lg"
        formId="po-modal-form"
        submitLabel={t("inventory.createPo")}
        cancelLabel={t("common.cancel")}
        submitLoading={busy}
      >
        <CustomForm
          id="po-modal-form"
          className={formStackClass}
          initialValues={poInitial}
          validationSchema={purchaseOrderFormSchema}
          onSubmit={createPO}
        >
          {() => (
            <PurchaseOrderFormFields
              supplierOptions={supplierOptions}
              productOptions={poProductOptions}
              products={poSupplierProducts}
              productsLoading={poSupplierProductsLoading}
              onSupplierChange={(sid) => void loadPoSupplierProducts(sid)}
              t={t}
            />
          )}
        </CustomForm>
      </FormModal>

      <FormModal
        isOpen={modal === "grn"}
        onClose={() => {
          setModal(null);
          setGrnInitial(emptyGrnForm());
        }}
        title={t("inventory.receiveGrnTitle")}
        description={t("inventory.receiveGrnDesc")}
        size="lg"
        formId="grn-modal-form"
        submitLabel={t("inventory.receiveGrn")}
        cancelLabel={t("common.cancel")}
        submitLoading={busy}
        submitIcon={<Check className="h-4 w-4" />}
      >
        <CustomForm
          id="grn-modal-form"
          className={formStackClass}
          initialValues={grnInitial}
          validationSchema={grnFormSchema}
          onSubmit={receiveGRN}
        >
          {() => (
            <GrnFormFields openPos={openPos} products={products} t={t} />
          )}
        </CustomForm>
      </FormModal>

      <FormModal
        isOpen={!!attachSupplierProductId}
        onClose={() => {
          setAttachSupplierProductId(null);
          setAttachSupplierInitial(emptyAttachSupplierForm());
        }}
        title={t("table.attachSupplier")}
        description={t("table.suppliersAttached")}
        formId="attach-supplier-form"
        submitLabel={t("table.attachSupplier")}
        cancelLabel={t("common.cancel")}
        submitLoading={busy}
      >
        <CustomForm
          id="attach-supplier-form"
          className={formStackClass}
          initialValues={attachSupplierInitial}
          validationSchema={attachSupplierFormSchema}
          onSubmit={attachSupplier}
        >
          {() => (
            <AttachSupplierFormFields supplierOptions={supplierOptions} t={t} />
          )}
        </CustomForm>
      </FormModal>

      <FormModal
        isOpen={modal === "transfer"}
        onClose={() => setModal(null)}
        title={t("inventory.transferModalTitle")}
        description={t("inventory.transferModalDesc")}
        size="lg"
        formId="transfer-modal-form"
        submitLabel={t("inventory.createTransfer")}
        cancelLabel={t("common.cancel")}
        submitLoading={busy}
      >
        <CustomForm
          id="transfer-modal-form"
          className={formStackClass}
          initialValues={transferInitial}
          validationSchema={transferFormSchema}
          onSubmit={createTransfer}
        >
          {() => (
            <TransferFormFields
              branchOptions={branchOptions}
              productOptions={productOptions}
              productMetaById={transferProductMetaById}
              t={t}
            />
          )}
        </CustomForm>
      </FormModal>
    </WorkspacePageScaffold>
  );
}
