import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
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
import * as ImagePicker from "expo-image-picker";
import { canAccessRoute } from "../lib/rbac";

type Tab = "stock" | "products" | "suppliers" | "pos" | "transfers" | "adjust";
type ModalKind = "product" | "supplier" | null;

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
  const [session, setLocal] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("stock");
  const [modal, setModal] = useState<ModalKind>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
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

  const [poForm, setPoForm] = useState({
    supplier_id: "",
    product_id: "",
    quantity: "10",
    unit_cost: "50",
  });
  const [grnForm, setGrnForm] = useState({
    purchase_order_id: "",
    product_id: "",
    quantity_received: "",
  });
  const [transferForm, setTransferForm] = useState({
    to_branch_id: "",
    product_id: "",
    quantity: "1",
  });
  const [adjustForm, setAdjustForm] = useState({
    product_id: "",
    quantity_delta: "",
    reason_code: "adjustment",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, s, sup, poList, tr] = await Promise.all([
        api<{ data: Product[] }>("/products"),
        api<{ data: StockRow[] }>("/inventory").catch(() => ({ data: [] as StockRow[] })),
        api<{ data: Supplier[] }>("/suppliers").catch(() => ({ data: [] as Supplier[] })),
        api<{ data: PO[] }>("/inventory/purchase-orders").catch(() => ({
          data: [] as PO[],
        })),
        api<{ data: Transfer[] }>("/inventory/transfers").catch(() => ({
          data: [] as Transfer[],
        })),
      ]);
      setProducts(p.data || []);
      setStock(s.data || []);
      setSuppliers(sup.data || []);
      setPos(poList.data || []);
      setTransfers(tr.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (!canAccessRoute(s, "/inventory")) {
        router.replace("/dashboard");
        return;
      }
      setLocal(s);
      await load();
    })();
  }, [load]);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      setProductImage({
        uri: asset.uri,
        name: asset.fileName || "product.jpg",
        type: asset.mimeType || "image/jpeg",
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supplier failed");
    }
  }

  async function createPO() {
    try {
      await api("/inventory/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          supplier_id: poForm.supplier_id,
          items: [
            {
              product_id: poForm.product_id,
              quantity: poForm.quantity,
              unit_cost: poForm.unit_cost,
            },
          ],
        }),
      });
      setMessage("PO created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PO failed");
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GRN failed");
    }
  }

  async function createTransfer() {
    try {
      await api("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: session?.branch_id,
          to_branch_id: transferForm.to_branch_id,
          items: [
            {
              product_id: transferForm.product_id,
              quantity: transferForm.quantity,
            },
          ],
        }),
      });
      setMessage("Transfer created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    }
  }

  async function confirmTransfer(id: string) {
    try {
      await api(`/inventory/transfers/${id}/confirm`, { method: "POST", body: "{}" });
      setMessage("Transfer confirmed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    }
  }

  async function adjustStock() {
    try {
      await api("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          ...adjustForm,
        }),
      });
      setMessage("Stock adjusted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
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
          {products.map((p) => (
            <Text key={p.id} style={styles.body}>
              {p.sku} · {p.name} · Rs {p.price ?? "—"}
            </Text>
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
            <TextInput
              style={styles.input}
              placeholder="Supplier ID"
              value={poForm.supplier_id}
              onChangeText={(v) => setPoForm({ ...poForm, supplier_id: v })}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text style={styles.hint}>
              Tip: copy an id from Suppliers tab, or pick first:{" "}
              {suppliers[0]?.id?.slice(0, 8) || "—"}
            </Text>
            <Pressable
              style={styles.chip}
              onPress={() =>
                suppliers[0] &&
                setPoForm({ ...poForm, supplier_id: suppliers[0].id })
              }
            >
              <Text style={styles.chipText}>Use first supplier</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Product ID"
              value={poForm.product_id}
              onChangeText={(v) => setPoForm({ ...poForm, product_id: v })}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.chip}
              onPress={() =>
                products[0] &&
                setPoForm({ ...poForm, product_id: products[0].id })
              }
            >
              <Text style={styles.chipText}>Use first product</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Qty"
              value={poForm.quantity}
              onChangeText={(v) => setPoForm({ ...poForm, quantity: v })}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.input}
              placeholder="Unit cost"
              value={poForm.unit_cost}
              onChangeText={(v) => setPoForm({ ...poForm, unit_cost: v })}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
            />
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
          <TextInput
            style={styles.input}
            placeholder="To branch ID"
            value={transferForm.to_branch_id}
            onChangeText={(v) =>
              setTransferForm({ ...transferForm, to_branch_id: v })
            }
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.chip}
            onPress={() =>
              products[0] &&
              setTransferForm({ ...transferForm, product_id: products[0].id })
            }
          >
            <Text style={styles.chipText}>Use first product</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={transferForm.product_id}
            onChangeText={(v) =>
              setTransferForm({ ...transferForm, product_id: v })
            }
            placeholder="Product ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={transferForm.quantity}
            onChangeText={(v) =>
              setTransferForm({ ...transferForm, quantity: v })
            }
            placeholder="Qty"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.btn} onPress={createTransfer}>
            <Text style={styles.btnText}>Create transfer</Text>
          </Pressable>
          {transfers.map((t) => (
            <View key={t.id} style={styles.row}>
              <Text style={[styles.body, { flex: 1 }]}>
                {t.status} · {t.items?.[0]?.quantity || "?"} units
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
          <Pressable
            style={styles.chip}
            onPress={() =>
              products[0] &&
              setAdjustForm({ ...adjustForm, product_id: products[0].id })
            }
          >
            <Text style={styles.chipText}>Use first product</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={adjustForm.product_id}
            onChangeText={(v) => setAdjustForm({ ...adjustForm, product_id: v })}
            placeholder="Product ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
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

      <BarcodeScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(code) => setProductForm((prev) => ({ ...prev, barcode: code }))}
        title="Scan product barcode"
      />
    </>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.brand,
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
