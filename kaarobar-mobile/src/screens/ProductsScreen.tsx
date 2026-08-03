import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
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
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { SearchSelect, SearchMultiSelect } from "../components/SearchSelect";
import { replacePath } from "../lib/nav";
import { useTabParam } from "../hooks/useTabParam";
import { inventoryKeys } from "../lib/queryClient";

type Tab = "stock" | "products" | "suppliers" | "pos" | "transfers" | "adjust";
const PRODUCT_TABS: readonly Tab[] = [
  "stock",
  "products",
  "suppliers",
  "pos",
  "transfers",
  "adjust",
];
type ModalKind = "product" | "supplier" | "transfer" | null;

type Product = { id: string; sku: string; name: string; price?: string };
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
  catalogs?: string[];
  status?: string;
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
    catalogs: "",
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

  const businessId = session?.business_id ?? null;
  const ready = !!session;
  const needProducts =
    tab === "products" || tab === "pos" || tab === "transfers" || tab === "adjust";
  const needSuppliers =
    tab === "suppliers" || tab === "pos" || !!attachProductId;

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
    enabled: ready && tab === "pos",
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
          catalogs: supplierForm.catalogs
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
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
        catalogs: "",
      });
      setModal(null);
      setMessage("Supplier added");
      setTab("suppliers");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supplier failed");
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
        setError("Select supplier and at least one product");
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
      setMessage("PO created");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PO failed");
    }
  }

  async function attachSupplier() {
    if (!attachProductId || !attachSupplierId) return;
    try {
      await api(`/products/${attachProductId}/suppliers`, {
        method: "POST",
        body: JSON.stringify({ supplier_id: attachSupplierId }),
      });
      setMessage("Supplier attached");
      setAttachProductId(null);
      setAttachSupplierId(null);
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attach failed");
    }
  }

  async function receiveGRN() {
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
      setMessage("GRN received");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GRN failed");
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
      setMessage("Transfer created");
      setModal(null);
      setTransferForm({ to_branch_id: "", product_ids: [], quantities: {} });
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    }
  }

  async function confirmTransfer(id: string) {
    try {
      await api(`/inventory/transfers/${id}/confirm`, { method: "POST", body: "{}" });
      setMessage("Transfer confirmed");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
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
                {p.sku} · {p.name} · Rs {p.price ?? "—"}
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
          {suppliers.map((s) => (
            <View key={s.id} style={{ marginBottom: 10 }}>
              <Text style={[styles.body, { fontWeight: "700" }]}>{s.name}</Text>
              <Text style={styles.hint}>
                {[s.contact_name, s.contact_phone, s.city].filter(Boolean).join(" · ") ||
                  "No contact yet"}
              </Text>
              {(s.catalogs || []).length > 0 ? (
                <Text style={styles.hint}>{(s.catalogs || []).join(", ")}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {tab === "pos" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.section}>New PO</Text>
            <SearchSelect
              label="Supplier"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              value={poForm.supplier_id || null}
              onChange={(supplier_id) =>
                setPoForm((f) => ({ ...f, supplier_id: supplier_id || "" }))
              }
              placeholder="Select supplier…"
            />
            <SearchMultiSelect
              label="Products"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.sku})`,
              }))}
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
              placeholder="Select products…"
            />
            {poForm.product_ids.map((id) => {
              const p = products.find((x) => x.id === id);
              return (
                <View key={id} style={{ marginBottom: 8 }}>
                  <Text style={styles.hint}>{p?.name || id}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Qty"
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
                    placeholder="Unit cost"
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
            <Pressable style={styles.btn} onPress={createPO}>
              <Text style={styles.btnText}>Create PO</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Receive GRN</Text>
            {pos
              .filter((p) => p.status !== "received" && p.status !== "cancelled")
              .map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.chip}
                  onPress={() =>
                    setGrnForm({
                      purchase_order_id: p.id,
                      product_id: p.items[0]?.product_id || "",
                      quantity_received: p.items[0]?.quantity || "",
                    })
                  }
                >
                  <Text style={styles.chipText}>
                    {p.supplier_name || p.id.slice(0, 8)} · {p.status}
                  </Text>
                </Pressable>
              ))}
            <TextInput
              style={styles.input}
              placeholder="Qty received"
              value={grnForm.quantity_received}
              onChangeText={(v) =>
                setGrnForm({ ...grnForm, quantity_received: v })
              }
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
            />
            <Pressable style={styles.btn} onPress={receiveGRN}>
              <Text style={styles.btnText}>Receive</Text>
            </Pressable>
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
        subtitle="Company, contact person, and catalogs."
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
        <TextInput
          style={styles.input}
          placeholder="Catalogs (comma-separated)"
          value={supplierForm.catalogs}
          onChangeText={(v) => setSupplierForm({ ...supplierForm, catalogs: v })}
          placeholderTextColor={colors.muted}
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
