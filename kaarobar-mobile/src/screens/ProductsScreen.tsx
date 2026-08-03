import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, getSession, type Session } from "../lib/api";
import { FormModal } from "../components/FormModal";
import { BarcodeScannerModal } from "../components/BarcodeScannerModal";
import SegmentedTabs from "../components/SegmentedTabs";
import ListToolbar, { emptyStaffFilters } from "../components/ListToolbar";
import { applyListingFilters } from "../lib/listingFilters";
import { pickImageFromLibrary } from "../lib/imagePicker";
import { canAccessRoute } from "../lib/rbac";
import { formatDecimal } from "../lib/decimal";
import { generateBarcode } from "../lib/barcode";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { SearchSelect, SearchMultiSelect } from "../components/SearchSelect";
import { replacePath } from "../lib/nav";
import { useTabParam } from "../hooks/useTabParam";
import { inventoryKeys } from "../lib/queryClient";
import { t } from "../lib/i18n";

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
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const queryClient = useQueryClient();
  const [session, setLocal] = useState<Session | null>(null);
  const [tab, setTab] = useTabParam<Tab>("stock", PRODUCT_TABS);
  const [modal, setModal] = useState<ModalKind>(null);
  const [productFilters, setProductFilters] = useState(emptyStaffFilters());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    price: "",
    barcode: "",
    unit: "pcs",
    product_kind: "goods",
  });
  const [productImage, setProductImage] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_name: "",
    contact_role: "",
    contact_phone: "",
    contact_email: "",
    city: "",
    payment_terms: "Net 30",
  });

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
  const [attachProductId, setAttachProductId] = useState<string | null>(null);
  const [attachSupplierId, setAttachSupplierId] = useState<string | null>(null);
  const [attachToSupplierId, setAttachToSupplierId] = useState<string | null>(null);
  const [attachProductForSupplierId, setAttachProductForSupplierId] = useState<
    string | null
  >(null);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [supplierProductsById, setSupplierProductsById] = useState<
    Record<string, Product[]>
  >({});
  const [supplierProductsForPo, setSupplierProductsForPo] = useState<Product[]>([]);
  const [grnForm, setGrnForm] = useState<{
    purchase_order_id: string;
    quantities: Record<string, string>;
  }>({
    purchase_order_id: "",
    quantities: {},
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
    queryFn: async (): Promise<Product[]> => {
      const res = await api<{ data: Product[] }>("/products");
      return res.data || [];
    },
    enabled: ready && needProducts,
  });
  const products: Product[] = productsData ?? [];

  const { data: stockData } = useQuery({
    queryKey: inventoryKeys.stock(businessId),
    queryFn: async (): Promise<StockRow[]> => {
      const res = await api<{ data: StockRow[] }>("/app/inventory").catch(() => ({
        data: [] as StockRow[],
      }));
      return res.data || [];
    },
    enabled: ready && tab === "stock",
  });
  const stock: StockRow[] = stockData ?? [];

  const { data: suppliersData } = useQuery({
    queryKey: inventoryKeys.suppliers(businessId),
    queryFn: async (): Promise<Supplier[]> => {
      const res = await api<{ data: Supplier[] }>("/suppliers").catch(() => ({
        data: [] as Supplier[],
      }));
      return res.data || [];
    },
    enabled: ready && needSuppliers,
  });
  const suppliers: Supplier[] = suppliersData ?? [];

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
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/inventory")) {
        replacePath(navigation, "/app/dashboard");
        return;
      }
      setLocal(s);
    })();
  }, [navigation]);

  useEffect(() => {
    if (!poForm.supplier_id || (tab !== "pos" && modal !== "po")) {
      setSupplierProductsForPo([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<{ data: Product[] }>(
          `/suppliers/${poForm.supplier_id}/products`
        );
        if (!cancelled) setSupplierProductsForPo(res.data || []);
      } catch {
        if (!cancelled) setSupplierProductsForPo([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poForm.supplier_id, tab, modal]);

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

  async function createProduct() {
    try {
      const fd = new FormData();
      Object.entries(productForm).forEach(([k, v]) => {
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
      setProductForm({
        sku: "",
        name: "",
        price: "",
        barcode: "",
        unit: "pcs",
        product_kind: "goods",
      });
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

  async function createSupplier() {
    try {
      await api("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          contact_name: supplierForm.contact_name.trim() || null,
          contact_role: supplierForm.contact_role.trim() || null,
          contact_phone: supplierForm.contact_phone.trim() || null,
          contact_email: supplierForm.contact_email.trim() || null,
          city: supplierForm.city.trim() || null,
          payment_terms: supplierForm.payment_terms.trim() || null,
          country: "PK",
          currency: "PKR",
          status: "active",
        }),
      });
      setSupplierForm({
        name: "",
        contact_name: "",
        contact_role: "",
        contact_phone: "",
        contact_email: "",
        city: "",
        payment_terms: "Net 30",
      });
      setModal(null);
      setMessage(t("inventory.supplierAdded"));
      setTab("suppliers");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.supplierFailed"));
    }
  }

  async function createPO() {
    try {
      const items = poForm.product_ids
        .map((product_id) => ({
          product_id,
          quantity: poForm.quantities[product_id] || "1",
          unit_cost: poForm.unit_costs[product_id] || "0",
        }))
        .filter((i) => Number(i.quantity) > 0);
      if (!poForm.supplier_id || items.length === 0) {
        setError(t("inventory.poFailed"));
        return;
      }
      await api("/inventory/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          supplier_id: poForm.supplier_id,
          items,
        }),
      });
      setPoForm({
        supplier_id: "",
        product_ids: [],
        quantities: {},
        unit_costs: {},
      });
      setSupplierProductsForPo([]);
      setModal(null);
      setMessage(t("inventory.poCreated"));
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.poFailed"));
    }
  }

  async function attachSupplier() {
    if (!attachProductId || !attachSupplierId) return;
    const sid = attachSupplierId;
    try {
      await api(`/suppliers/${sid}/products`, {
        method: "POST",
        body: JSON.stringify({ product_id: attachProductId }),
      });
      setMessage(t("inventory.productAttached"));
      setAttachProductId(null);
      setAttachSupplierId(null);
      await refreshInventory();
      if (expandedSupplierId === sid) {
        await loadSupplierProducts(sid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function attachProductToSupplier() {
    if (!attachToSupplierId || !attachProductForSupplierId) return;
    try {
      await api(`/suppliers/${attachToSupplierId}/products`, {
        method: "POST",
        body: JSON.stringify({ product_id: attachProductForSupplierId }),
      });
      setMessage(t("inventory.productAttached"));
      const sid = attachToSupplierId;
      setAttachToSupplierId(null);
      setAttachProductForSupplierId(null);
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
      setGrnForm({ purchase_order_id: poId, quantities });
    } else {
      setGrnForm({ purchase_order_id: "", quantities: {} });
    }
    setModal("grn");
  }

  function selectPoForGrn(poId: string | null) {
    if (!poId) {
      setGrnForm({ purchase_order_id: "", quantities: {} });
      return;
    }
    const po = pos.find((p) => p.id === poId);
    const quantities: Record<string, string> = {};
    for (const item of po?.items || []) {
      quantities[item.product_id] = item.quantity;
    }
    setGrnForm({ purchase_order_id: poId, quantities });
  }

  async function receiveGRN() {
    try {
      if (!grnForm.purchase_order_id) {
        setError(t("inventory.selectPo"));
        return;
      }
      const items = Object.entries(grnForm.quantities)
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
          purchase_order_id: grnForm.purchase_order_id,
          items,
        }),
      });
      setMessage(t("inventory.grnReceived"));
      setGrnForm({ purchase_order_id: "", quantities: {} });
      setModal(null);
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.grnFailed"));
    }
  }

  async function createTransfer() {
    try {
      if (!transferForm.to_branch_id || transferForm.product_ids.length === 0) {
        setError("Select branch and products");
        return;
      }
      const items = transferForm.product_ids.map((product_id) => ({
        product_id,
        quantity: transferForm.quantities[product_id] || "1",
      }));
      await api("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: session?.branch_id,
          to_branch_id: transferForm.to_branch_id,
          items,
        }),
      });
      setMessage(t("inventory.transferCreated"));
      setModal(null);
      setTransferForm({ to_branch_id: "", product_ids: [], quantities: {} });
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

  async function adjustStock() {
    if (!adjustForm.product_id) {
      setError("Select a product");
      return;
    }
    try {
      await api("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          ...adjustForm,
        }),
      });
      setMessage("Stock adjusted");
      setAdjustForm({ product_id: "", quantity_delta: "", reason_code: "adjustment" });
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  const openPos = pos.filter(
    (p) => p.status !== "received" && p.status !== "cancelled"
  );
  const selectedGrnPo = openPos.find((p) => p.id === grnForm.purchase_order_id) || null;
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

      <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />

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
        <View style={styles.card}>
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
                  setAttachSupplierId(null);
                }}
              >
                <Text style={styles.chipText}>Attach supplier</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {tab === "suppliers" ? (
        <View style={styles.card}>
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
                        setAttachProductForSupplierId(null);
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
        </View>
      ) : null}

      {tab === "pos" ? (
        <>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, { flex: 1 }]}
              onPress={() => {
                setPoForm({
                  supplier_id: "",
                  product_ids: [],
                  quantities: {},
                  unit_costs: {},
                });
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
          <View style={styles.card}>
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
          </View>
        </>
      ) : null}

      {tab === "transfers" ? (
        <View style={styles.card}>
          <Pressable
            style={styles.btn}
            onPress={() => {
              setTransferForm({ to_branch_id: "", product_ids: [], quantities: {} });
              setModal("transfer");
            }}
          >
            <Text style={styles.btnText}>Create transfer</Text>
          </Pressable>
          {transfers.map((t) => (
            <View key={t.id} style={styles.row}>
              <Text style={[styles.body, { flex: 1 }]}>
                {t.status} ·{" "}
                {(t.items || []).map((i) => i.quantity).join(", ") || "?"} units
              </Text>
              {t.status === "pending" ? (
                <Pressable style={styles.btn} onPress={() => confirmTransfer(t.id)}>
                  <Text style={styles.btnText}>Confirm</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {tab === "adjust" ? (
        <View style={styles.card}>
          <SearchSelect
            label="Product"
            options={products.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.sku})`,
            }))}
            value={adjustForm.product_id || null}
            onChange={(product_id) =>
              setAdjustForm((f) => ({ ...f, product_id: product_id || "" }))
            }
            placeholder="Select product"
          />
          <View style={{ height: 12 }} />
          <TextInput
            style={styles.input}
            value={adjustForm.quantity_delta}
            onChangeText={(v) =>
              setAdjustForm({ ...adjustForm, quantity_delta: v })
            }
            placeholder="Qty delta (e.g. -2)"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={adjustForm.reason_code}
            onChangeText={(v) =>
              setAdjustForm({ ...adjustForm, reason_code: v })
            }
            placeholder="Reason code"
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.btn} onPress={adjustStock}>
            <Text style={styles.btnText}>Apply adjustment</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>

      <FormModal
        visible={modal === "product"}
        title="New product"
        subtitle="Scan a barcode, add a photo, then save."
        onClose={() => setModal(null)}
        onSubmit={createProduct}
        submitLabel="Create product"
      >
        <TextInput
          style={styles.input}
          placeholder="SKU"
          value={productForm.sku}
          onChangeText={(v) => setProductForm({ ...productForm, sku: v })}
          placeholderTextColor={colors.muted}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Barcode"
            value={productForm.barcode}
            onChangeText={(v) => setProductForm({ ...productForm, barcode: v })}
            placeholderTextColor={colors.muted}
          />
          <Pressable
            style={styles.btn}
            onPress={() =>
              setProductForm((prev) => ({ ...prev, barcode: generateBarcode() }))
            }
          >
            <Text style={styles.btnText}>Generate</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => setScanOpen(true)}>
            <Text style={styles.btnText}>Scan</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={productForm.name}
          onChangeText={(v) => setProductForm({ ...productForm, name: v })}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Price"
          value={productForm.price}
          onChangeText={(v) => setProductForm({ ...productForm, price: v })}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.muted}
        />
        <Pressable style={styles.chip} onPress={pickImage}>
          <Text style={styles.chipText}>
            {productImage ? "Photo selected ✓" : "Add product photo"}
          </Text>
        </Pressable>
      </FormModal>

      <FormModal
        visible={modal === "supplier"}
        title="Add supplier"
        subtitle={t("inventory.contactSection")}
        onClose={() => setModal(null)}
        onSubmit={createSupplier}
        submitLabel="Add supplier"
      >
        <TextInput
          style={styles.input}
          placeholder="Company / trade name *"
          value={supplierForm.name}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, name: v })}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Contact person"
          value={supplierForm.contact_name}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, contact_name: v })}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Role (e.g. Account manager)"
          value={supplierForm.contact_role}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, contact_role: v })}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          value={supplierForm.contact_phone}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, contact_phone: v })}
          keyboardType="phone-pad"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={supplierForm.contact_email}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, contact_email: v })}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="City"
          value={supplierForm.city}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, city: v })}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Payment terms (Net 30)"
          value={supplierForm.payment_terms}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, payment_terms: v })}
          placeholderTextColor={colors.muted}
        />
      </FormModal>

      <FormModal
        visible={modal === "po"}
        title={t("inventory.newPoTitle")}
        subtitle={t("inventory.poModalDesc")}
        onClose={() => setModal(null)}
        onSubmit={createPO}
        submitLabel={t("inventory.createPo")}
      >
        <SearchSelect
          label={t("inventory.supplier")}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          value={poForm.supplier_id || null}
          onChange={(supplier_id) =>
            setPoForm({
              supplier_id: supplier_id || "",
              product_ids: [],
              quantities: {},
              unit_costs: {},
            })
          }
          placeholder={t("inventory.selectSupplier")}
        />
        {poForm.supplier_id && poProductOptions.length === 0 ? (
          <Text style={styles.hint}>{t("inventory.poNoSupplierProducts")}</Text>
        ) : null}
        {poForm.supplier_id && poProductOptions.length > 0 ? (
          <Text style={styles.hint}>{t("inventory.supplierProductsHint")}</Text>
        ) : null}
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
          placeholder={t("inventory.selectProducts")}
          disabled={!poForm.supplier_id}
        />
        {poForm.product_ids.map((id) => {
          const p = supplierProductsForPo.find((x) => x.id === id);
          return (
            <View key={id} style={{ marginBottom: 8 }}>
              <Text style={styles.hint}>{p?.name || id}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("common.quantity")}
                value={poForm.quantities[id] || ""}
                onChangeText={(v) =>
                  setPoForm((f) => ({
                    ...f,
                    quantities: { ...f.quantities, [id]: v },
                  }))
                }
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                style={styles.input}
                placeholder={t("inventory.unitCost")}
                value={poForm.unit_costs[id] || ""}
                onChangeText={(v) =>
                  setPoForm((f) => ({
                    ...f,
                    unit_costs: { ...f.unit_costs, [id]: v },
                  }))
                }
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
              />
            </View>
          );
        })}
      </FormModal>

      <FormModal
        visible={modal === "grn"}
        title={t("inventory.receiveGrnTitle")}
        subtitle={t("inventory.receiveGrnDesc")}
        onClose={() => {
          setModal(null);
          setGrnForm({ purchase_order_id: "", quantities: {} });
        }}
        onSubmit={receiveGRN}
        submitLabel={t("inventory.receiveGrn")}
      >
        <SearchSelect
          label={t("inventory.selectPo")}
          options={openPos.map((p) => ({
            value: p.id,
            label: `${p.supplier_name || p.id.slice(0, 8)} · ${p.status}`,
          }))}
          value={grnForm.purchase_order_id || null}
          onChange={(poId) => selectPoForGrn(poId)}
          placeholder={t("inventory.selectPo")}
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
                <TextInput
                  style={styles.input}
                  placeholder={t("inventory.qtyReceived")}
                  value={grnForm.quantities[item.product_id] || ""}
                  onChangeText={(v) =>
                    setGrnForm((f) => ({
                      ...f,
                      quantities: { ...f.quantities, [item.product_id]: v },
                    }))
                  }
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))
          : null}
      </FormModal>

      <FormModal
        visible={modal === "attachToSupplier"}
        title={t("inventory.attachProduct")}
        subtitle={t("inventory.attachProductDesc")}
        onClose={() => {
          setModal(null);
          setAttachToSupplierId(null);
          setAttachProductForSupplierId(null);
        }}
        onSubmit={attachProductToSupplier}
        submitLabel={t("inventory.attachProduct")}
      >
        <SearchSelect
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
          value={attachProductForSupplierId}
          onChange={setAttachProductForSupplierId}
          placeholder={t("inventory.selectProduct")}
        />
      </FormModal>

      <FormModal
        visible={modal === "transfer"}
        title="Create transfer"
        onClose={() => setModal(null)}
        onSubmit={createTransfer}
        submitLabel="Create transfer"
      >
        <SearchSelect
          label="To branch"
          options={branches
            .filter((b) => b.id !== session?.branch_id)
            .map((b) => ({ value: b.id, label: b.name }))}
          value={transferForm.to_branch_id || null}
          onChange={(to_branch_id) =>
            setTransferForm((f) => ({ ...f, to_branch_id: to_branch_id || "" }))
          }
          placeholder="Select branch"
        />
        <View style={{ height: 12 }} />
        <SearchMultiSelect
          label="Products"
          options={products.map((p) => ({
            value: p.id,
            label: `${p.name} (${p.sku})`,
          }))}
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
          placeholder="Select products"
        />
        {transferForm.product_ids.map((id) => {
          const p = products.find((x) => x.id === id);
          return (
            <View key={id} style={{ marginTop: 10 }}>
              <Text style={styles.body}>{p?.name || id}</Text>
              <TextInput
                style={styles.input}
                value={transferForm.quantities[id] || "1"}
                onChangeText={(v) =>
                  setTransferForm((f) => ({
                    ...f,
                    quantities: { ...f.quantities, [id]: v },
                  }))
                }
                keyboardType="decimal-pad"
                placeholder="Qty"
                placeholderTextColor={colors.muted}
              />
            </View>
          );
        })}
      </FormModal>

      <FormModal
        visible={!!attachProductId}
        title="Attach supplier"
        onClose={() => {
          setAttachProductId(null);
          setAttachSupplierId(null);
        }}
        onSubmit={attachSupplier}
      >
        <SearchSelect
          label="Supplier"
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          value={attachSupplierId}
          onChange={setAttachSupplierId}
          placeholder="Select supplier…"
        />
      </FormModal>

      <BarcodeScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(code) => setProductForm((prev) => ({ ...prev, barcode: code }))}
        title="Scan product barcode"
      />
    </>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  container: { flex: 1, padding: 16, backgroundColor: colors.bgPrimary },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading, marginBottom: 4 },
  lead: { color: colors.body, marginBottom: 12, fontSize: 14 },
  error: { color: colors.danger, marginBottom: 8 },
  message: { color: colors.body, marginBottom: 8 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  section: { fontWeight: "700", color: colors.heading, marginBottom: 8 },
  productName: { fontWeight: "700", color: colors.heading },
  body: { color: colors.body, marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.heading,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: palette.brand,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  btnText: { color: colors.white, fontWeight: "700" },
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  chipText: { color: colors.heading, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
});
}
