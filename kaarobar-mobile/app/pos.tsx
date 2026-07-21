import { useCallback, useEffect, useMemo, useState } from "react";
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
import { uuid } from "../lib/uuid";
import { t } from "../lib/i18n";
import { canAccessRoute } from "../lib/rbac";

type Product = {
  id: string;
  sku: string;
  name: string;
  price?: string;
  tax_rate?: string;
  barcode?: string;
  image_url?: string;
};

type CartLine = { product: Product; quantity: number; unit_price: number };

type Customer = { id: string; name: string; khata_enabled?: boolean };

type Receipt = {
  invoice_number: string;
  total_amount: string;
  customer_name?: string | null;
  items: { name: string; quantity: string; line_total: string }[];
  payments: { method: string; amount: string }[];
};

type Till = {
  id: string;
  status: string;
  opening_cash: string;
  over_short?: string | null;
};

function money(n: number) {
  return n.toFixed(2);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export default function PosScreen() {
  const [session, setLocal] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [till, setTill] = useState<Till | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [payCash, setPayCash] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payWallet, setPayWallet] = useState("");
  const [payKhata, setPayKhata] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const loadTill = useCallback(async () => {
    try {
      const res = await api<{ data: Till | null }>("/tills/current");
      setTill(res.data);
    } catch {
      setTill(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (!canAccessRoute(s, "/pos")) {
        router.replace("/dashboard");
        return;
      }
      setLocal(s);
      try {
        const [prod, cust] = await Promise.all([
          api<{ data: Product[] }>("/products"),
          api<{ data: Customer[] }>("/customers").catch(() => ({ data: [] as Customer[] })),
        ]);
        setProducts(prod.data || []);
        setCustomers(cust.data || []);
        await loadTill();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, [loadTill]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
    );
  }, [products, query]);

  async function lookupBarcode(code: string) {
    try {
      const res = await api<{ data: Product }>(
        `/products/by-barcode/${encodeURIComponent(code)}`
      );
      addProduct(res.data);
      setMessage(`Added ${res.data.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Barcode not found");
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discount = round2(Math.min(Math.max(Number(discountInput || 0), 0), subtotal));
  const tax = round2(Math.max(Number(taxInput || 0), 0));
  const total = round2(subtotal - discount + tax);

  useEffect(() => {
    setPayCash(money(total));
    setPayCard("");
    setPayWallet("");
    setPayKhata("");
  }, [total]);

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unit_price: Number(product.price || 0) },
      ];
    });
  }

  function setQty(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l))
    );
  }

  async function openTill() {
    if (!session?.branch_id) {
      setMessage("Select a branch from the dashboard first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Till }>("/tills/open", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          opening_cash: openingCash || "0",
        }),
      });
      setTill(res.data);
      setMessage("Till opened");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open till");
    } finally {
      setBusy(false);
    }
  }

  async function closeTill() {
    if (!till?.id) return;
    setBusy(true);
    try {
      const res = await api<{ data: Till }>(`/tills/${till.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closing_cash: closingCash || "0" }),
      });
      setTill(null);
      setClosingCash("");
      const over = res.data.over_short;
      setMessage(
        over && Number(over) !== 0
          ? `Till closed (over/short ${over})`
          : "Till closed"
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not close till");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!session?.branch_id) {
      setMessage("Select a branch from the dashboard first.");
      return;
    }
    const payments: { method: string; amount: number }[] = [];
    const cash = Number(payCash || 0);
    const card = Number(payCard || 0);
    const wallet = Number(payWallet || 0);
    const khata = Number(payKhata || 0);
    if (cash > 0) payments.push({ method: "cash", amount: round2(cash) });
    if (card > 0) payments.push({ method: "card", amount: round2(card) });
    if (wallet > 0) payments.push({ method: "wallet", amount: round2(wallet) });
    if (khata > 0) payments.push({ method: "khata", amount: round2(khata) });
    const paySum = round2(payments.reduce((s, p) => s + p.amount, 0));
    if (payments.length === 0 || Math.abs(paySum - total) > 0.001) {
      setMessage(`Payments must total ${money(total)} (got ${money(paySum)})`);
      return;
    }
    if (khata > 0 && !customerId) {
      setMessage("Select a customer for khata");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Receipt }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          client_txn_id: uuid(),
          till_id: till?.id,
          customer_id: customerId || undefined,
          items: cart.map((l) => ({
            product_id: l.product.id,
            quantity: l.quantity,
          })),
          discount_amount: discount,
          tax_amount: tax,
          payments,
        }),
      });
      setCart([]);
      setReceipt(res.data);
      setMessage(`Sale ${res.data.invoice_number}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.eyebrow}>Cashier</Text>
      <Text style={styles.title}>Point of sale</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable style={styles.scanBtn} onPress={() => setScanOpen(true)}>
        <Text style={styles.btnText}>Scan barcode</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.section}>Till</Text>
        {till ? (
          <>
            <Text style={styles.body}>Open · float Rs {till.opening_cash}</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={closingCash}
                onChangeText={setClosingCash}
                placeholder="Closing cash"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
              />
              <Pressable style={styles.btnSecondary} onPress={closeTill} disabled={busy}>
                <Text style={styles.btnSecondaryText}>Close</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={openingCash}
              onChangeText={setOpeningCash}
              placeholder="Opening cash"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
            />
            <Pressable style={styles.btn} onPress={openTill} disabled={busy}>
              <Text style={styles.btnText}>Open</Text>
            </Pressable>
          </View>
        )}
      </View>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search SKU / name"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.count}>{filtered.length} products</Text>

      <View style={styles.productGrid}>
        {filtered.map((p) => {
          const inCart = cart.find((l) => l.product.id === p.id);
          return (
            <Pressable
              key={p.id}
              style={[styles.product, inCart ? styles.productActive : null]}
              onPress={() => addProduct(p)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {p.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
              <Text style={styles.productName}>{p.name}</Text>
              <Text style={styles.sku}>{p.sku}</Text>
              <View style={styles.productFooter}>
                <Text style={styles.productPrice}>Rs {p.price ?? "0.00"}</Text>
                {inCart ? (
                  <Text style={styles.qtyChip}>×{inCart.quantity}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Order detail</Text>
        {cart.length === 0 ? (
          <Text style={styles.body}>Cart is empty — tap a product to start.</Text>
        ) : (
          cart.map((l) => (
            <View key={l.product.id} style={styles.cartLine}>
              <Text style={styles.productName}>{l.product.name}</Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQty(l.product.id, l.quantity - 1)}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qty}>{l.quantity}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQty(l.product.id, l.quantity + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
                <Text style={styles.lineTotal}>
                  {money(l.quantity * l.unit_price)}
                </Text>
              </View>
            </View>
          ))
        )}
        <View style={styles.totals}>
          <Text style={styles.body}>{t("common.subtotal")} {money(subtotal)}</Text>
          <Text style={styles.body}>{t("common.tax")} {money(tax)}</Text>
          <View style={styles.row}>
            <Text style={[styles.body, { width: 88, marginBottom: 0 }]}>{t("pos.discount")}</Text>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={discountInput}
              onChangeText={setDiscountInput}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.body, { width: 88, marginBottom: 0 }]}>{t("pos.taxOptional")}</Text>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={taxInput}
              onChangeText={setTaxInput}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>
          <Text style={styles.total}>{t("common.total")} Rs {money(total)}</Text>
        </View>

        <Text style={styles.payLabel}>Customer</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {customers.slice(0, 12).map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, customerId === c.id && styles.chipOn]}
                onPress={() => setCustomerId(customerId === c.id ? "" : c.id)}
              >
                <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]}>
                  {c.name}
                  {c.khata_enabled ? " ·K" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.payLabel}>Payment</Text>
        {(
          [
            ["Cash", payCash, setPayCash],
            ["Card", payCard, setPayCard],
            ["Wallet", payWallet, setPayWallet],
            ["Khata", payKhata, setPayKhata],
          ] as const
        ).map(([label, value, setter]) => (
          <View key={label} style={styles.row}>
            <Text style={[styles.body, { width: 56, marginBottom: 0 }]}>{label}</Text>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={value}
              onChangeText={setter}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
            />
          </View>
        ))}

        <Pressable
          style={[styles.btn, styles.charge, cart.length === 0 || busy ? styles.btnDisabled : null]}
          onPress={checkout}
          disabled={cart.length === 0 || busy}
        >
          <Text style={styles.btnText}>{busy ? t("pos.processing") : `${t("pos.placeOrder")} →`}</Text>
        </Pressable>
      </View>
    </ScrollView>
    <BarcodeScannerModal
      visible={scanOpen}
      onClose={() => setScanOpen(false)}
      onScan={lookupBarcode}
      title="Scan to cart"
    />
    {receipt ? (
      <View style={styles.receiptOverlay}>
        <View style={styles.receiptCard}>
          <Text style={styles.title}>Invoice {receipt.invoice_number}</Text>
          {receipt.customer_name ? (
            <Text style={styles.body}>Customer: {receipt.customer_name}</Text>
          ) : null}
          {receipt.items.map((item, i) => (
            <Text key={`${item.name}-${i}`} style={styles.body}>
              {item.name} × {item.quantity} · {item.line_total}
            </Text>
          ))}
          <Text style={styles.total}>Total Rs {receipt.total_amount}</Text>
          {receipt.payments.map((p, i) => (
            <Text key={`${p.method}-${i}`} style={styles.body}>
              {p.method}: {p.amount}
            </Text>
          ))}
          <Pressable style={styles.btn} onPress={() => setReceipt(null)}>
            <Text style={styles.btnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    ) : null}
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
  eyebrow: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.heading, marginBottom: 8, marginTop: 4 },
  message: { color: colors.body, marginBottom: 8 },
  scanBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  count: { color: colors.muted, fontSize: 13, marginBottom: 10, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  section: { fontWeight: "700", color: colors.heading, marginBottom: 8, fontSize: 16 },
  body: { color: colors.body, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.heading,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  charge: { marginTop: 8, paddingVertical: 14 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontWeight: "700" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  btnSecondaryText: { color: colors.heading, fontWeight: "600" },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  product: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  productActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight || colors.brandSoft,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  productName: { fontWeight: "700", color: colors.heading },
  sku: { color: colors.muted, fontSize: 12, marginTop: 2 },
  productFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productPrice: { color: colors.heading, fontWeight: "700" },
  qtyChip: {
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  cartLine: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  qtyBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  qtyBtnText: { fontSize: 18, color: colors.heading },
  qty: { width: 28, textAlign: "center", color: colors.heading, fontWeight: "700" },
  lineTotal: { marginLeft: "auto", fontWeight: "700", color: colors.heading },
  totals: { marginTop: 8, marginBottom: 8 },
  total: { fontSize: 22, fontWeight: "800", color: colors.heading, marginTop: 4 },
  payLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.heading, fontWeight: "600", fontSize: 12 },
  chipTextOn: { color: colors.white },
  receiptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  receiptCard: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
  },
});
