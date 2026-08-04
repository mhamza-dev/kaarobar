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
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import {
  Field,
  SurfaceCard,
  fieldClass,
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
import SearchSelect from "@/components/ui/SearchSelect";
import SearchMultiSelect from "@/components/ui/SearchMultiSelect";
import Select from "@/components/ui/Select";
import { inventoryKeys } from "@/lib/queryClient";
import ProductFormModal from "@/components/inventory/ProductFormModal";
import SupplierFormModal from "@/components/inventory/SupplierFormModal";
import WorkspacePageScaffold from "@/components/app/WorkspacePageScaffold";
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
  tags: "",
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
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  const [grnForm, setGrnForm] = useState<{
    purchase_order_id: string;
    quantities: Record<string, string>;
  }>({
    purchase_order_id: "",
    quantities: {},
  });
  const [poSupplierProducts, setPoSupplierProducts] = useState<Product[]>([]);
  const [poSupplierProductsLoading, setPoSupplierProductsLoading] = useState(false);
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
    const po = pos.find((p) => p.id === grnForm.purchase_order_id);
    const items = (po?.items || [])
      .map((item) => ({
        product_id: item.product_id,
        quantity_received: grnForm.quantities[item.product_id] || "0",
      }))
      .filter((i) => Number(i.quantity_received) > 0);
    if (!grnForm.purchase_order_id || items.length === 0) {
      toast.error(t("inventory.grnFailed"));
      return;
    }
    setBusy(true);
    try {
      await api("/inventory/grn", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          purchase_order_id: grnForm.purchase_order_id,
          items,
        }),
      });
      toast.success(t("inventory.grnReceived"));
      setGrnForm({ purchase_order_id: "", quantities: {} });
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
    setGrnForm({
      purchase_order_id: poId || "",
      quantities,
    });
    setModal("grn");
  }

  function selectPoForGrn(poId: string) {
    const po = pos.find((p) => p.id === poId);
    const quantities: Record<string, string> = {};
    for (const item of po?.items || []) {
      quantities[item.product_id] = item.quantity || "0";
    }
    setGrnForm({ purchase_order_id: poId, quantities });
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
                setPoForm({
                  supplier_id: "",
                  product_ids: [],
                  quantities: {},
                  unit_costs: {},
                });
                setPoSupplierProducts([]);
                setModal("po");
              },
              icon: <Truck className="h-4 w-4" />,
            }
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

  const selectedGrnPo = useMemo(
    () => pos.find((p) => p.id === grnForm.purchase_order_id) || null,
    [pos, grnForm.purchase_order_id]
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
            <Button type="submit" startIcon={<SlidersHorizontal className="h-4 w-4" />}>
              Apply adjustment
            </Button>
          </form>
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
        editingSupplierId={editingSupplierId}
        supplierForm={supplierForm}
        setSupplierForm={setSupplierForm}
        busy={busy}
        onClose={closeSupplierModal}
        onSubmit={saveSupplier}
      />

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
            onChange={(supplier_id) => {
              const sid = supplier_id || "";
              setPoForm({
                supplier_id: sid,
                product_ids: [],
                quantities: {},
                unit_costs: {},
              });
              void loadPoSupplierProducts(sid);
            }}
            placeholder={t("inventory.selectSupplier")}
            searchPlaceholder={t("searchSelect.search")}
          />
          <SearchMultiSelect
            label={t("inventory.products")}
            options={poProductOptions}
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
            disabled={!poForm.supplier_id || poSupplierProductsLoading}
          />
          {poForm.supplier_id && !poSupplierProductsLoading && poProductOptions.length === 0 ? (
            <p className="text-sm text-body">{t("inventory.poNoSupplierProducts")}</p>
          ) : null}
          {poForm.supplier_id && poProductOptions.length > 0 ? (
            <p className="text-sm text-muted">{t("inventory.supplierProductsHint")}</p>
          ) : null}
          {poForm.product_ids.length > 0 ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {t("inventory.quantities")}
              </p>
              {poForm.product_ids.map((id) => {
                const p = poSupplierProducts.find((x) => x.id === id);
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
        isOpen={modal === "grn"}
        onClose={() => {
          setModal(null);
          setGrnForm({ purchase_order_id: "", quantities: {} });
        }}
        title={t("inventory.receiveGrnTitle")}
        description={t("inventory.receiveGrnDesc")}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModal(null);
                setGrnForm({ purchase_order_id: "", quantities: {} });
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              form="grn-modal-form"
              loading={busy}
              disabled={!grnForm.purchase_order_id}
              startIcon={<Check className="h-4 w-4" />}
            >
              {t("inventory.receiveGrn")}
            </Button>
          </div>
        }
      >
        <form id="grn-modal-form" onSubmit={receiveGRN} className="space-y-5">
          <SearchSelect
            label={t("inventory.selectPo")}
            options={openPos.map((p) => ({
              value: p.id,
              label: `${p.supplier_name || p.id.slice(0, 8)} · ${p.status}`,
            }))}
            value={grnForm.purchase_order_id || null}
            onChange={(poId) => {
              if (poId) selectPoForGrn(poId);
              else setGrnForm({ purchase_order_id: "", quantities: {} });
            }}
            placeholder={t("inventory.selectPo")}
            searchPlaceholder={t("searchSelect.search")}
          />
          {openPos.length === 0 ? (
            <p className="text-sm text-body">{t("inventory.noOpenPos")}</p>
          ) : null}
          {selectedGrnPo ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              {(selectedGrnPo.items || []).map((item) => (
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
                      value={grnForm.quantities[item.product_id] || ""}
                      onChange={(e) =>
                        setGrnForm((f) => ({
                          ...f,
                          quantities: {
                            ...f.quantities,
                            [item.product_id]: e.target.value,
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
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
                const quantities = Object.fromEntries(
                  product_ids.map((id) => [id, f.quantities[id] || "1"])
                );
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
                const meta = transferProductMetaById.get(id);
                const displayName = meta?.name || `${id.slice(0, 8)}...`;
                const displaySku = meta?.sku || null;
                return (
                  <div key={id} className="grid gap-2 sm:grid-cols-[1fr_7rem] sm:items-end">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-heading">{displayName}</p>
                      <p className="truncate text-xs text-muted">{displaySku || id}</p>
                    </div>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      className={fieldClass}
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
    </WorkspacePageScaffold>
  );
}
