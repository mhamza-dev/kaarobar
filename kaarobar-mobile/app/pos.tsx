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

type Product = {
  id: string;
  sku: string;
  name: string;
  price?: string;
  tax_rate?: string;
};

type CartLine = { product: Product; quantity: number; unit_price: number };

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
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setLocal(s);
      try {
        const res = await api<{ data: Product[] }>("/products");
        setProducts(res.data || []);
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
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const tax = cart.reduce((s, l) => {
    const rate = Number(l.product.tax_rate || 0.18);
    return s + l.quantity * l.unit_price * rate;
  }, 0);
  const total = round2(subtotal + tax);

  useEffect(() => {
    setPayCash(money(total));
    setPayCard("");
    setPayWallet("");
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
    if (cash > 0) payments.push({ method: "cash", amount: round2(cash) });
    if (card > 0) payments.push({ method: "card", amount: round2(card) });
    if (wallet > 0) payments.push({ method: "wallet", amount: round2(wallet) });
    const paySum = round2(payments.reduce((s, p) => s + p.amount, 0));
    if (payments.length === 0 || Math.abs(paySum - total) > 0.001) {
      setMessage(`Payments must total ${money(total)} (got ${money(paySum)})`);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: { invoice_number: string } }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          client_txn_id: uuid(),
          till_id: till?.id,
          items: cart.map((l) => ({
            product_id: l.product.id,
            quantity: l.quantity,
          })),
          payments,
        }),
      });
      setCart([]);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.eyebrow}>Cashier</Text>
      <Text style={styles.title}>Point of sale</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

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
          <Text style={styles.body}>Subtotal {money(subtotal)}</Text>
          <Text style={styles.body}>Tax {money(tax)}</Text>
          <Text style={styles.total}>Total Rs {money(total)}</Text>
        </View>

        <Text style={styles.payLabel}>Payment</Text>
        {(
          [
            ["Cash", payCash, setPayCash],
            ["Card", payCard, setPayCard],
            ["Wallet", payWallet, setPayWallet],
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
          <Text style={styles.btnText}>{busy ? "Processing…" : "Place order →"}</Text>
        </Pressable>
      </View>
    </ScrollView>
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
});
