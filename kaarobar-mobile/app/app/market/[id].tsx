import { useEffect, useMemo, useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, getSession, isConsumerSession } from "../../../lib/api";

type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: string | null;
};

type CartLine = { product: Product; quantity: number; unit_price: number };

export default function MarketStoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [businessName, setBusinessName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session || !isConsumerSession(session)) {
        router.replace("/login");
        return;
      }
      try {
        const res = await api<{
          data: { business: { id: string; name: string }; products: Product[] };
        }>(`/marketplace/businesses/${id}/catalog`, {}, null);
        setBusinessName(res.data.business.name);
        setBusinessId(res.data.business.id);
        setProducts(res.data.products || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load store");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unit_price, 0),
    [cart]
  );

  function addProduct(p: Product) {
    const price = Number(p.price || 0);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product: p, quantity: 1, unit_price: price }];
    });
  }

  async function checkout() {
    if (cart.length === 0 || !businessId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ data: { invoice_number: string; total_amount: string } }>(
        "/portal/orders",
        {
          method: "POST",
          body: JSON.stringify({
            business_id: businessId,
            payment_method: payMethod,
            notes: notes.trim() || undefined,
            items: cart.map((l) => ({
              product_id: l.product.id,
              quantity: l.quantity,
            })),
          }),
        }
      );
      setCart([]);
      setMessage(`Order placed · ${res.data.invoice_number} · Rs ${res.data.total_amount}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Link href="/app/dashboard" asChild>
        <Pressable>
          <Text style={styles.back}>← All stores</Text>
        </Pressable>
      </Link>
      <Text style={styles.title}>{businessName || "Store"}</Text>
      <Text style={styles.sub}>Pickup · card or wallet</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        renderItem={({ item }) => (
          <Pressable style={styles.product} onPress={() => addProduct(item)}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productPrice}>Rs {item.price || "0.00"}</Text>
          </Pressable>
        )}
      />

      <View style={styles.cart}>
        <Text style={styles.cartTitle}>
          Cart · {cart.length} · Rs {total.toFixed(2)}
        </Text>
        <TextInput
          style={styles.notes}
          placeholder="Pickup notes"
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
        />
        <View style={styles.payRow}>
          {(["card", "wallet"] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.payBtn, payMethod === m && styles.payOn]}
              onPress={() => setPayMethod(m)}
            >
              <Text style={[styles.payText, payMethod === m && styles.payTextOn]}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.checkout, (busy || cart.length === 0) && { opacity: 0.5 }]}
          disabled={busy || cart.length === 0}
          onPress={() => void checkout()}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.checkoutText}>Place order</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary },
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  back: { color: colors.brand, fontWeight: "700", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading },
  sub: { color: colors.body, marginBottom: 12 },
  error: { color: colors.danger, marginBottom: 8 },
  ok: { color: colors.success, marginBottom: 8 },
  product: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  productName: { fontWeight: "600", color: colors.heading, flex: 1 },
  productPrice: { fontWeight: "800", color: colors.heading },
  cart: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  cartTitle: { fontWeight: "800", color: colors.heading },
  notes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.heading,
    backgroundColor: colors.card,
  },
  payRow: { flexDirection: "row", gap: 8 },
  payBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  payOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  payText: { color: colors.heading, textTransform: "capitalize", fontWeight: "600" },
  payTextOn: { color: colors.white },
  checkout: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  checkoutText: { color: colors.white, fontWeight: "700" },
});
