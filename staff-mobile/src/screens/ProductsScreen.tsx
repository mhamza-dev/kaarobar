import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Theme, useTheme } from "@/theme";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, apiAllPages, getSession } from "@/lib/api";
import EntityFormModal from "@/components/screen/entity-form-modal";
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal";
import ScreenTabs from "@/components/screen/screen-tabs";
import ListToolbar, { emptyStaffFilters } from "@/components/list-toolbar";
import ScreenCard from "@/components/screen/screen-card";
import { applyListingFilters } from "@core/lib/listingFilters";
import { pickImageFromLibrary } from "@/lib/imagePicker";

import { formatDecimal } from "@core/lib/decimal";
import { generateBarcode } from "@core/lib/barcode";
import { useScreenGate } from "@/hooks/use-screen-gate";
import { ScreenGateFallback } from "@/components/ui/screen-gate";
import { useTabParam } from "@/hooks/useTabParam";
import { inventoryKeys } from "@/lib/queryClient";
import { t } from "@shared/i18n";
import CustomForm from "@shared/form/custom-form";
import {
  FormikTextField,
  FormikSearchSelectField,
  FormikSearchMultiSelectField,
} from "@shared/form/form-fields";
import {
  emptyProductForm,
  emptySupplierForm,
  productFormSchema,
  supplierFormSchema,
  type ProductFormValues,
  type SupplierFormValues,
} from "@core/validations/products";
import {
  adjustStockFormSchema,
  attachProductFormSchema,
  attachSupplierFormSchema,
  emptyAdjustStockForm,
  emptyAttachProductForm,
  emptyAttachSupplierForm,
  emptyGrnForm,
  emptyPurchaseOrderForm,
  emptyTransferForm,
  grnFormSchema,
  purchaseOrderFormSchema,
  transferFormSchema,
  type AdjustStockFormValues,
  type AttachProductFormValues,
  type AttachSupplierFormValues,
  type GrnFormValues,
  type PurchaseOrderFormValues,
  type TransferFormValues,
} from "@core/validations/inventory";

type Tab = "stock" | "products" | "suppliers" | "pos" | "transfers" | "adjust";
const PRODUCT_TABS: readonly Tab[] = [
  "stock",
  "products",
  "suppliers",
  "pos",
  "transfers",
  "adjust",
];
type ModalKind = "product" | "supplier" | "po" | "transfer" | "grn" | "attachToSupplier" | null;

type Product = {
  id: string;
  sku: string;
  name: string;
  price?: string;
  unit?: string;
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
  contact_name?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  status?: string;
};
type PO = {
  id: string;
  status: string;
  supplier_name?: string;
  supplier_id: string;
  items: {
    product_id: string;
    product_name?: string | null;
    product_sku?: string | null;
    quantity: string;
    unit_cost: string;
  }[];
};
type Transfer = {
  id: string;
  status: string;
  items: { product_id: string; quantity: string }[];
};

export default function InventoryScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { session, status: gateStatus, retry: gateRetry } = useScreenGate("/app/inventory");
  const [tab, setTab] = useTabParam<Tab>("stock", PRODUCT_TABS);
  const [modal, setModal] = useState<ModalKind>(null);
  const [productFilters, setProductFilters] = useState(emptyStaffFilters());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [productInitial, setProductInitial] = useState(emptyProductForm());
  const [productImage, setProductImage] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [supplierInitial] = useState(emptySupplierForm());
  const [poInitial, setPoInitial] = useState(emptyPurchaseOrderForm());
  const [poSupplierId, setPoSupplierId] = useState("");
  const [attachProductId, setAttachProductId] = useState<string | null>(null);
  const [attachToSupplierId, setAttachToSupplierId] = useState<string | null>(null);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [supplierProductsById, setSupplierProductsById] = useState<
    Record<string, Product[]>
  >({});
  const [supplierProductsForPo, setSupplierProductsForPo] = useState<Product[]>([]);
  const [grnInitial, setGrnInitial] = useState(emptyGrnForm());
  const [transferInitial, setTransferInitial] = useState(emptyTransferForm());
  const [adjustInitial, setAdjustInitial] = useState(emptyAdjustStockForm());
  const barcodeSetterRef = useRef<((code: string) => void) | null>(null);
  const registerBarcodeSetter = useCallback((fn: (code: string) => void) => {
    barcodeSetterRef.current = fn;
  }, []);

  const businessId = session?.business_id ?? null;
  const ready = !!session;
  const needProducts =
    tab === "products" ||
    tab === "pos" ||
    tab === "transfers" ||
    tab === "adjust" ||
    modal === "po" ||
    modal === "grn" ||
    modal === "attachToSupplier" ||
    !!attachToSupplierId;
  const needSuppliers =
    tab === "suppliers" || tab === "pos" || modal === "po" || !!attachProductId;

  const { data: productsData } = useQuery({
    queryKey: inventoryKeys.products(businessId),
    queryFn: async (): Promise<Product[]> => apiAllPages<Product>("/products"),
    enabled: ready && needProducts,
  });
  const products: Product[] = productsData ?? [];

  const { data: stockData } = useQuery({
    queryKey: inventoryKeys.stock(businessId),
    queryFn: async (): Promise<StockRow[]> => {
      try {
        return await apiAllPages<StockRow>("/inventory");
      } catch {
        return [] as StockRow[];
      }
    },
    enabled: ready && tab === "stock",
  });
  const stock: StockRow[] = stockData ?? [];

  const { data: suppliersData } = useQuery({
    queryKey: inventoryKeys.suppliers(businessId),
    queryFn: async (): Promise<Supplier[]> => {
      try {
        return await apiAllPages<Supplier>("/suppliers");
      } catch {
        return [] as Supplier[];
      }
    },
    enabled: ready && needSuppliers,
  });
  // Same reason as cart's stores: the `?? []` fallback is a new array each
  // render, which would re-fire the supplier prefetch effect below every time.
  const suppliers: Supplier[] = useMemo(() => suppliersData ?? [], [suppliersData]);

  const { data: posData } = useQuery({
    queryKey: inventoryKeys.purchaseOrders(businessId),
    queryFn: async (): Promise<PO[]> => {
      const res = await api<{ data: PO[] }>("/inventory/purchase-orders").catch(
        () => ({ data: [] as PO[] })
      );
      return res.data || [];
    },
    enabled: ready && (tab === "pos" || modal === "grn"),
  });
  const pos: PO[] = posData ?? [];

  const { data: transfersData } = useQuery({
    queryKey: inventoryKeys.transfers(businessId),
    queryFn: async (): Promise<Transfer[]> => {
      const res = await api<{ data: Transfer[] }>("/inventory/transfers").catch(
        () => ({ data: [] as Transfer[] })
      );
      return res.data || [];
    },
    enabled: ready && tab === "transfers",
  });
  const transfers: Transfer[] = transfersData ?? [];

  const { data: branchesData } = useQuery({
    queryKey: inventoryKeys.branches(businessId),
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      if (!businessId) return [];
      const res = await api<{ data: { id: string; name: string }[] }>(
        `/businesses/${businessId}/branches`
      ).catch(() => ({ data: [] as { id: string; name: string }[] }));
      return res.data || [];
    },
    enabled: ready && tab === "transfers" && !!businessId,
  });
  const branches: { id: string; name: string }[] = branchesData ?? [];

  async function refreshInventory() {
    await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
  }

  useEffect(() => {
    (async () => {
    })();
  }, []);

  const poProductsActive = !!poSupplierId && (tab === "pos" || modal === "po");

  // Clearing on deactivation is a state reset, not a subscription — doing it
  // during render keeps the effect below purely about fetching.
  const [wasPoProductsActive, setWasPoProductsActive] = useState(poProductsActive);
  if (poProductsActive !== wasPoProductsActive) {
    setWasPoProductsActive(poProductsActive);
    if (!poProductsActive) setSupplierProductsForPo([]);
  }

  useEffect(() => {
    if (!poProductsActive) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<{ data: Product[] }>(
          `/suppliers/${poSupplierId}/products`
        );
        if (!cancelled) setSupplierProductsForPo(res.data || []);
      } catch {
        if (!cancelled) setSupplierProductsForPo([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poProductsActive, poSupplierId]);

  useEffect(() => {
    if (tab !== "suppliers" || suppliers.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const s of suppliers) {
        if (cancelled) return;
        try {
          const res = await api<{ data: Product[] }>(
            `/suppliers/${s.id}/products`
          );
          if (cancelled) return;
          setSupplierProductsById((prev) =>
            prev[s.id] ? prev : { ...prev, [s.id]: res.data || [] }
          );
        } catch {
          /* ignore per-supplier prefetch errors */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, suppliers]);

  async function loadSupplierProducts(supplierId: string) {
    try {
      const res = await api<{ data: Product[] }>(
        `/suppliers/${supplierId}/products`
      );
      setSupplierProductsById((prev) => ({
        ...prev,
        [supplierId]: res.data || [],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function toggleSupplierExpand(supplierId: string) {
    if (expandedSupplierId === supplierId) {
      setExpandedSupplierId(null);
      return;
    }
    setExpandedSupplierId(supplierId);
    if (!supplierProductsById[supplierId]) {
      await loadSupplierProducts(supplierId);
    }
  }

  async function createProduct(values: ProductFormValues) {
    try {
      const fd = new FormData();
      const payload: Record<string, string> = {
        sku: values.sku,
        name: values.name,
        price: values.price,
        barcode: values.barcode || "",
        unit: values.unit,
        product_kind: values.product_kind,
      };
      Object.entries(payload).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      if (productImage) {
        fd.append("image", {
          uri: productImage.uri,
          name: productImage.name,
          type: productImage.type,
        } as unknown as Blob);
      }
      await api("/products", { method: "POST", body: fd });
      setProductInitial(emptyProductForm());
      setProductImage(null);
      setModal(null);
      setMessage("Product created");
      setTab("products");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function pickImage() {
    const asset = await pickImageFromLibrary();
    if (asset) {
      setProductImage({
        uri: asset.uri,
        name: asset.fileName || "product.jpg",
        type: asset.type || "image/jpeg",
      });
    }
  }

  async function createSupplier(values: SupplierFormValues) {
    try {
      await api("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          contact_name: values.contact_name.trim() || null,
          contact_role: values.contact_role.trim() || null,
          contact_phone: values.contact_phone.trim() || null,
          contact_email: values.contact_email.trim() || null,
          city: values.city.trim() || null,
          payment_terms: values.payment_terms.trim() || null,
          country: "PK",
          currency: "PKR",
          status: "active",
        }),
      });
      setModal(null);
      setMessage(t("inventory.supplierAdded"));
      setTab("suppliers");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.supplierFailed"));
    }
  }

  async function createPO(values: PurchaseOrderFormValues) {
    try {
      const items = values.product_ids
        .map((product_id) => ({
          product_id,
          quantity: values.quantities[product_id] || "1",
          unit_cost: values.unit_costs[product_id] || "0",
        }))
        .filter((i) => Number(i.quantity) > 0);
      if (!values.supplier_id || items.length === 0) {
        setError(t("inventory.poFailed"));
        return;
      }
      await api("/inventory/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          supplier_id: values.supplier_id,
          items,
        }),
      });
      setPoInitial(emptyPurchaseOrderForm());
      setPoSupplierId("");
      setSupplierProductsForPo([]);
      setModal(null);
      setMessage(t("inventory.poCreated"));
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.poFailed"));
    }
  }

  async function attachSupplier(values: AttachSupplierFormValues) {
    if (!attachProductId) return;
    const sid = values.supplier_id;
    try {
      await api(`/suppliers/${sid}/products`, {
        method: "POST",
        body: JSON.stringify({ product_id: attachProductId }),
      });
      setMessage(t("inventory.productAttached"));
      setAttachProductId(null);
      await refreshInventory();
      if (expandedSupplierId === sid) {
        await loadSupplierProducts(sid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function attachProductToSupplier(values: AttachProductFormValues) {
    if (!attachToSupplierId) return;
    try {
      await api(`/suppliers/${attachToSupplierId}/products`, {
        method: "POST",
        body: JSON.stringify({ product_id: values.product_id }),
      });
      setMessage(t("inventory.productAttached"));
      const sid = attachToSupplierId;
      setAttachToSupplierId(null);
      setModal(null);
      await loadSupplierProducts(sid);
      setExpandedSupplierId(sid);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function detachProductFromSupplier(supplierId: string, productId: string) {
    Alert.alert(t("inventory.detachProduct"), t("inventory.detachProductConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("inventory.detachProduct"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await api(`/suppliers/${supplierId}/products/${productId}`, {
                method: "DELETE",
              });
              setMessage(t("inventory.productDetached"));
              await loadSupplierProducts(supplierId);
            } catch (err) {
              setError(err instanceof Error ? err.message : t("common.error"));
            }
          })();
        },
      },
    ]);
  }

  function openReceiveGrn(poId?: string) {
    if (poId) {
      const po = pos.find((p) => p.id === poId);
      const quantities: Record<string, string> = {};
      for (const item of po?.items || []) {
        quantities[item.product_id] = item.quantity;
      }
      setGrnInitial({ purchase_order_id: poId, quantities });
    } else {
      setGrnInitial(emptyGrnForm());
    }
    setModal("grn");
  }

  function selectPoForGrn(
    poId: string | null,
    setFieldValue: (field: string, value: unknown) => void
  ) {
    if (!poId) {
      void setFieldValue("purchase_order_id", "");
      void setFieldValue("quantities", {});
      return;
    }
    const po = pos.find((p) => p.id === poId);
    const quantities: Record<string, string> = {};
    for (const item of po?.items || []) {
      quantities[item.product_id] = item.quantity;
    }
    void setFieldValue("purchase_order_id", poId);
    void setFieldValue("quantities", quantities);
  }

  async function receiveGRN(values: GrnFormValues) {
    try {
      if (!values.purchase_order_id) {
        setError(t("inventory.selectPo"));
        return;
      }
      const items = Object.entries(values.quantities)
        .map(([product_id, quantity_received]) => ({
          product_id,
          quantity_received,
        }))
        .filter((i) => Number(i.quantity_received) > 0);
      if (items.length === 0) {
        setError(t("inventory.grnFailed"));
        return;
      }
      await api("/inventory/grn", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          purchase_order_id: values.purchase_order_id,
          items,
        }),
      });
      setMessage(t("inventory.grnReceived"));
      setGrnInitial(emptyGrnForm());
      setModal(null);
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.grnFailed"));
    }
  }

  async function createTransfer(values: TransferFormValues) {
    try {
      if (!values.to_branch_id || values.product_ids.length === 0) {
        setError("Select branch and products");
        return;
      }
      const items = values.product_ids.map((product_id) => ({
        product_id,
        quantity: values.quantities[product_id] || "1",
      }));
      await api("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: session?.branch_id,
          to_branch_id: values.to_branch_id,
          items,
        }),
      });
      setMessage(t("inventory.transferCreated"));
      setModal(null);
      setTransferInitial(emptyTransferForm());
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.transferFailed"));
    }
  }

  async function confirmTransfer(id: string) {
    try {
      await api(`/inventory/transfers/${id}/confirm`, { method: "POST", body: "{}" });
      setMessage(t("inventory.transferConfirmed"));
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.confirmFailed"));
    }
  }

  async function adjustStock(values: AdjustStockFormValues) {
    try {
      await api("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          ...values,
        }),
      });
      setMessage("Stock adjusted");
      setAdjustInitial(emptyAdjustStockForm());
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    }
  }

  if (gateStatus !== "ready" || !session) {
    return (
      <ScreenGateFallback
        status={gateStatus}
        featureName="Inventory"
        onRetry={gateRetry}
      />
    );
  }

  const openPos = pos.filter(
    (p) => p.status !== "received" && p.status !== "cancelled"
  );
  const poProductOptions = supplierProductsForPo.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.sku})`,
  }));

  const tabs: { id: Tab; label: string }[] = [
    { id: "stock", label: "Stock" },
    { id: "products", label: "Products" },
    { id: "suppliers", label: "Suppliers" },
    { id: "pos", label: "PO/GRN" },
    { id: "transfers", label: "Transfers" },
    { id: "adjust", label: "Adjust" },
  ];

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Inventory</Text>
      <Text style={styles.lead}>Stock, suppliers, and purchasing for this branch.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <ScreenTabs tabs={tabs} value={tab} onChange={setTab} />

      {(tab === "products" || tab === "suppliers") && (
        <Pressable
          style={styles.btn}
          onPress={() => setModal(tab === "products" ? "product" : "supplier")}
        >
          <Text style={styles.btnText}>
            {tab === "products" ? "New product" : "Add supplier"}
          </Text>
        </Pressable>
      )}

      {tab === "stock"
        ? stock.map((row) => (
            <View key={row.product_id} style={styles.card}>
              <Text style={styles.productName}>
                {row.name} ({row.sku})
              </Text>
              <Text style={styles.body}>
                On hand {row.quantity_on_hand} · avg {row.avg_cost}
              </Text>
            </View>
          ))
        : null}

      {tab === "products" ? (
        <ScreenCard style={styles.card}>
          <ListToolbar
            value={productFilters}
            onChange={setProductFilters}
            searchPlaceholder="Search SKU or name…"
            embedded
            config={{ showPriceRange: true }}
          />
          {applyListingFilters(products, productFilters, {
            searchText: (p) => `${p.sku} ${p.name}`,
            price: (p) => Number(p.price || 0),
          }).map((p) => (
            <View
              key={p.id}
              style={{
                marginBottom: 10,
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Text style={[styles.body, { flex: 1 }]}>
                {p.sku} · {p.name} · Rs {p.price != null && p.price !== "" ? formatDecimal(p.price) : "—"}
              </Text>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  setAttachProductId(p.id);
                }}
              >
                <Text style={styles.chipText}>Attach supplier</Text>
              </Pressable>
            </View>
          ))}
        </ScreenCard>
      ) : null}

      {tab === "suppliers" ? (
        <ScreenCard style={styles.card}>
          {suppliers.map((s) => {
            const linked = supplierProductsById[s.id] || [];
            const expanded = expandedSupplierId === s.id;
            return (
              <View key={s.id} style={{ marginBottom: 12 }}>
                <Pressable onPress={() => void toggleSupplierExpand(s.id)}>
                  <Text style={[styles.body, { fontWeight: "700" }]}>{s.name}</Text>
                  <Text style={styles.hint}>
                    {[s.contact_name, s.contact_phone, s.city]
                      .filter(Boolean)
                      .join(" · ") || "No contact yet"}
                  </Text>
                  {supplierProductsById[s.id] ? (
                    <Text style={styles.hint}>
                      {linked.length === 0
                        ? t("inventory.noSupplierProducts")
                        : `${linked.length} · ${t("inventory.supplierProducts")}`}
                      {expanded ? " ▾" : " ▸"}
                    </Text>
                  ) : (
                    <Text style={styles.hint}>
                      {t("inventory.supplierProducts")}
                      {expanded ? " ▾" : " ▸"}
                    </Text>
                  )}
                </Pressable>
                {expanded ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.section}>{t("inventory.supplierProducts")}</Text>
                    {linked.length === 0 ? (
                      <Text style={styles.hint}>{t("inventory.noSupplierProducts")}</Text>
                    ) : (
                      linked.map((p) => (
                        <View
                          key={p.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <Text style={styles.body}>
                            {p.sku} · {p.name}
                          </Text>
                          <Pressable
                            style={styles.chip}
                            onPress={() => detachProductFromSupplier(s.id, p.id)}
                          >
                            <Text style={styles.chipText}>{t("inventory.detachProduct")}</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                    <Pressable
                      style={styles.btn}
                      onPress={() => {
                        setAttachToSupplierId(s.id);
                        setModal("attachToSupplier");
                      }}
                    >
                      <Text style={styles.btnText}>{t("inventory.attachProduct")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScreenCard>
      ) : null}

      {tab === "pos" ? (
        <>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, { flex: 1 }]}
              onPress={() => {
                setPoInitial(emptyPurchaseOrderForm());
                setPoSupplierId("");
                setSupplierProductsForPo([]);
                setModal("po");
              }}
            >
              <Text style={styles.btnText}>{t("inventory.newPo")}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { flex: 1 }]}
              onPress={() => openReceiveGrn()}
            >
              <Text style={styles.btnText}>{t("inventory.receiveGrn")}</Text>
            </Pressable>
          </View>
          <ScreenCard style={styles.card}>
            {pos.map((p) => (
              <View key={p.id} style={styles.row}>
                <Text style={[styles.body, { flex: 1 }]}>
                  {p.supplier_name || p.id.slice(0, 8)} · {p.status} ·{" "}
                  {p.items?.length || 0} {t("inventory.products").toLowerCase()}
                </Text>
                {p.status !== "received" && p.status !== "cancelled" ? (
                  <Pressable style={styles.chip} onPress={() => openReceiveGrn(p.id)}>
                    <Text style={styles.chipText}>{t("inventory.receiveGrn")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScreenCard>
        </>
      ) : null}

      {tab === "transfers" ? (
        <ScreenCard style={styles.card}>
          <Pressable
            style={styles.btn}
            onPress={() => {
              setTransferInitial(emptyTransferForm());
              setModal("transfer");
            }}
          >
            <Text style={styles.btnText}>Create transfer</Text>
          </Pressable>
          {transfers.map((transfer) => (
            <View key={transfer.id} style={styles.row}>
              <Text style={[styles.body, { flex: 1 }]}>
                {transfer.status} ·{" "}
                {(transfer.items || []).map((i) => i.quantity).join(", ") || "?"} units
              </Text>
              {transfer.status === "pending" ? (
                <Pressable style={styles.btn} onPress={() => confirmTransfer(transfer.id)}>
                  <Text style={styles.btnText}>Confirm</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScreenCard>
      ) : null}

      {tab === "adjust" ? (
        <ScreenCard style={styles.card}>
          <CustomForm
            initialValues={adjustInitial}
            validationSchema={adjustStockFormSchema}
            enableReinitialize
            onSubmit={adjustStock}
          >
            {({ handleSubmit }) => (
              <>
                <FormikSearchSelectField
                  name="product_id"
                  label="Product"
                  options={products.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.sku})`,
                  }))}
                  placeholder="Select product"
                />
                <FormikTextField
                  name="quantity_delta"
                  style={styles.input}
                  placeholder="Qty delta (e.g. -2)"
                  keyboardType="numbers-and-punctuation"
                />
                <FormikTextField
                  name="reason_code"
                  style={styles.input}
                  placeholder="Reason code"
                />
                <Pressable style={styles.btn} onPress={() => handleSubmit()}>
                  <Text style={styles.btnText}>Apply adjustment</Text>
                </Pressable>
              </>
            )}
          </CustomForm>
        </ScreenCard>
      ) : null}
    </ScrollView>

      <EntityFormModal
        visible={modal === "product"}
        title="New product"
        subtitle="Scan a barcode, add a photo, then save."
        onClose={() => setModal(null)}
        submitLabel="Create product"
        initialValues={productInitial}
        validationSchema={productFormSchema}
        enableReinitialize
        onSubmit={createProduct}
      >
        {({ setFieldValue }) => (
          <>
            <FormikTextField name="sku" style={styles.input} placeholder="SKU" />
            <View style={styles.row}>
              <FormikTextField
                name="barcode"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Barcode"
                containerStyle={{ flex: 1 }}
              />
              <Pressable
                style={styles.btn}
                onPress={() => {
                  void (async () => {
                    const s = await getSession();
                    const shopName =
                      s?.memberships?.find((m) => m.business_id === s.business_id)
                        ?.business_name || null;
                    void setFieldValue("barcode", generateBarcode(shopName));
                  })();
                }}
              >
                <Text style={styles.btnText}>Generate</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => setScanOpen(true)}>
                <Text style={styles.btnText}>Scan</Text>
              </Pressable>
            </View>
            <FormikTextField name="name" style={styles.input} placeholder="Name" />
            <FormikTextField
              name="price"
              style={styles.input}
              placeholder="Price"
              keyboardType="decimal-pad"
            />
            <Pressable style={styles.chip} onPress={pickImage}>
              <Text style={styles.chipText}>
                {productImage ? "Photo selected ✓" : "Add product photo"}
              </Text>
            </Pressable>
            <ProductBarcodeBridge
              setBarcode={(code) => void setFieldValue("barcode", code)}
              register={registerBarcodeSetter}
            />
          </>
        )}
      </EntityFormModal>

      <EntityFormModal
        visible={modal === "supplier"}
        title="Add supplier"
        subtitle={t("inventory.contactSection")}
        onClose={() => setModal(null)}
        submitLabel="Add supplier"
        initialValues={supplierInitial}
        validationSchema={supplierFormSchema}
        onSubmit={createSupplier}
      >
        {() => (
          <>
            <FormikTextField
              name="name"
              style={styles.input}
              placeholder="Company / trade name *"
            />
            <FormikTextField
              name="contact_name"
              style={styles.input}
              placeholder="Contact person"
            />
            <FormikTextField
              name="contact_role"
              style={styles.input}
              placeholder="Role (e.g. Account manager)"
            />
            <FormikTextField
              name="contact_phone"
              style={styles.input}
              placeholder="Phone"
              keyboardType="phone-pad"
            />
            <FormikTextField
              name="contact_email"
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormikTextField name="city" style={styles.input} placeholder="City" />
            <FormikTextField
              name="payment_terms"
              style={styles.input}
              placeholder="Payment terms (Net 30)"
            />
          </>
        )}
      </EntityFormModal>

      <EntityFormModal
        visible={modal === "po"}
        title={t("inventory.newPoTitle")}
        subtitle={t("inventory.poModalDesc")}
        onClose={() => setModal(null)}
        submitLabel={t("inventory.createPo")}
        initialValues={poInitial}
        validationSchema={purchaseOrderFormSchema}
        enableReinitialize
        onSubmit={createPO}
      >
        {({ values, setFieldValue }) => (
          <>
            <FormikSearchSelectField
              name="supplier_id"
              label={t("inventory.supplier")}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder={t("inventory.selectSupplier")}
              onValueChange={(supplier_id) => {
                setPoSupplierId(supplier_id || "");
                void setFieldValue("product_ids", []);
                void setFieldValue("quantities", {});
                void setFieldValue("unit_costs", {});
              }}
            />
            {values.supplier_id && poProductOptions.length === 0 ? (
              <Text style={styles.hint}>{t("inventory.poNoSupplierProducts")}</Text>
            ) : null}
            {values.supplier_id && poProductOptions.length > 0 ? (
              <Text style={styles.hint}>{t("inventory.supplierProductsHint")}</Text>
            ) : null}
            <FormikSearchMultiSelectField
              name="product_ids"
              label={t("inventory.products")}
              options={poProductOptions}
              placeholder={t("inventory.selectProducts")}
              disabled={!values.supplier_id}
              onValueChange={(product_ids) => {
                void setFieldValue(
                  "quantities",
                  Object.fromEntries(
                    product_ids.map((id) => [id, values.quantities[id] || "10"])
                  )
                );
                void setFieldValue(
                  "unit_costs",
                  Object.fromEntries(
                    product_ids.map((id) => [id, values.unit_costs[id] || "50"])
                  )
                );
              }}
            />
            {values.product_ids.map((id) => {
              const p = supplierProductsForPo.find((x) => x.id === id);
              return (
                <View key={id} style={{ marginBottom: 8 }}>
                  <Text style={styles.hint}>{p?.name || id}</Text>
                  <FormikTextField
                    name={`quantities.${id}`}
                    style={styles.input}
                    placeholder={t("common.quantity")}
                    keyboardType="decimal-pad"
                  />
                  <FormikTextField
                    name={`unit_costs.${id}`}
                    style={styles.input}
                    placeholder={t("inventory.unitCost")}
                    keyboardType="decimal-pad"
                  />
                </View>
              );
            })}
          </>
        )}
      </EntityFormModal>

      <EntityFormModal
        visible={modal === "grn"}
        title={t("inventory.receiveGrnTitle")}
        subtitle={t("inventory.receiveGrnDesc")}
        onClose={() => {
          setModal(null);
          setGrnInitial(emptyGrnForm());
        }}
        submitLabel={t("inventory.receiveGrn")}
        initialValues={grnInitial}
        validationSchema={grnFormSchema}
        enableReinitialize
        onSubmit={receiveGRN}
      >
        {({ values, setFieldValue }) => {
          const selectedGrnPo =
            openPos.find((p) => p.id === values.purchase_order_id) || null;
          return (
            <>
              <FormikSearchSelectField
                name="purchase_order_id"
                label={t("inventory.selectPo")}
                options={openPos.map((p) => ({
                  value: p.id,
                  label: `${p.supplier_name || p.id.slice(0, 8)} · ${p.status}`,
                }))}
                placeholder={t("inventory.selectPo")}
                onValueChange={(poId) => selectPoForGrn(poId, setFieldValue)}
              />
              {openPos.length === 0 ? (
                <Text style={styles.hint}>{t("inventory.noOpenPos")}</Text>
              ) : null}
              {selectedGrnPo
                ? (selectedGrnPo.items || []).map((item) => (
                    <View key={item.product_id} style={{ marginBottom: 10 }}>
                      <Text style={styles.body}>
                        {item.product_name || item.product_id}
                        {item.product_sku ? ` (${item.product_sku})` : ""}
                      </Text>
                      <Text style={styles.hint}>
                        {t("inventory.orderedQty")}: {item.quantity}
                      </Text>
                      <FormikTextField
                        name={`quantities.${item.product_id}`}
                        style={styles.input}
                        placeholder={t("inventory.qtyReceived")}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ))
                : null}
            </>
          );
        }}
      </EntityFormModal>

      <EntityFormModal
        visible={modal === "attachToSupplier"}
        title={t("inventory.attachProduct")}
        subtitle={t("inventory.attachProductDesc")}
        onClose={() => {
          setModal(null);
          setAttachToSupplierId(null);
        }}
        submitLabel={t("inventory.attachProduct")}
        initialValues={emptyAttachProductForm()}
        validationSchema={attachProductFormSchema}
        onSubmit={attachProductToSupplier}
      >
        {() => (
          <FormikSearchSelectField
            name="product_id"
            label={t("inventory.product")}
            options={products
              .filter(
                (p) =>
                  !attachToSupplierId ||
                  !(supplierProductsById[attachToSupplierId] || []).some(
                    (sp) => sp.id === p.id
                  )
              )
              .map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
            placeholder={t("inventory.selectProduct")}
          />
        )}
      </EntityFormModal>

      <EntityFormModal
        visible={modal === "transfer"}
        title="Create transfer"
        onClose={() => setModal(null)}
        submitLabel="Create transfer"
        initialValues={transferInitial}
        validationSchema={transferFormSchema}
        enableReinitialize
        onSubmit={createTransfer}
      >
        {({ values, setFieldValue }) => (
          <>
            <FormikSearchSelectField
              name="to_branch_id"
              label="To branch"
              options={branches
                .filter((b) => b.id !== session?.branch_id)
                .map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Select branch"
            />
            <View style={{ height: 12 }} />
            <FormikSearchMultiSelectField
              name="product_ids"
              label="Products"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.sku})`,
              }))}
              placeholder="Select products"
              onValueChange={(product_ids) => {
                const quantities = { ...values.quantities };
                for (const id of product_ids) {
                  if (!quantities[id]) quantities[id] = "1";
                }
                void setFieldValue("quantities", quantities);
              }}
            />
            {values.product_ids.map((id) => {
              const p = products.find((x) => x.id === id);
              return (
                <View key={id} style={{ marginTop: 10 }}>
                  <Text style={styles.body}>{p?.name || id}</Text>
                  <FormikTextField
                    name={`quantities.${id}`}
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="Qty"
                  />
                </View>
              );
            })}
          </>
        )}
      </EntityFormModal>

      <EntityFormModal
        visible={!!attachProductId}
        title="Attach supplier"
        onClose={() => {
          setAttachProductId(null);
        }}
        initialValues={emptyAttachSupplierForm()}
        validationSchema={attachSupplierFormSchema}
        onSubmit={attachSupplier}
      >
        {() => (
          <FormikSearchSelectField
            name="supplier_id"
            label="Supplier"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Select supplier…"
          />
        )}
      </EntityFormModal>

      <BarcodeScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(code) => {
          barcodeSetterRef.current?.(code);
          setScanOpen(false);
        }}
        title="Scan product barcode"
      />
    </>
  );
}

function ProductBarcodeBridge({
  setBarcode,
  register,
}: {
  setBarcode: (code: string) => void;
  register: (fn: (code: string) => void) => void;
}) {
  register(setBarcode);
  return null;
}

function createStyles(t: Theme) {
  return StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.bgPrimary,
  },
  container: { flex: 1, padding: 16, backgroundColor: t.bgPrimary },
  title: { fontSize: 22, fontWeight: "800", color: t.heading, marginBottom: 4 },
  lead: { color: t.body, marginBottom: 12, fontSize: 14 },
  error: { color: t.danger, marginBottom: 8 },
  message: { color: t.body, marginBottom: 8 },
  card: {
    backgroundColor: t.card,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  section: { fontWeight: "700", color: t.heading, marginBottom: 8 },
  productName: { fontWeight: "700", color: t.heading },
  body: { color: t.body, marginBottom: 6 },
  hint: { color: t.muted, fontSize: 12, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: t.bgSecondary,
    color: t.heading,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: t.brand,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  btnText: { color: t.white, fontWeight: "700" },
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  chipText: { color: t.heading, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
});
}
