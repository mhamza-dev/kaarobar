import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, getSession } from "../../../../lib/api";
import { useCart } from "../../../../lib/cart";
import { useToast } from "../../../../components/Toast";
import BuyerNav from "../../../../components/BuyerNav";

export default function CheckoutPayScreen() {
  const toast = useToast();
  const { stores, subtotal, clear, clearStore } = useCart();
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stores.length === 0) {
      router.replace("/app/dashboard");
      return;
    }
    void (async () => {
      const s = await getSession();
      if (s?.user) {
        setContactName(s.user.name || "");
        setPhone(s.user.phone || "");
      }
    })();
  }, [stores.length]);

  if (stores.length === 0) {
    return (
      <View style={styles.container}>
        <BuyerNav />
        <Text style={styles.empty}>Your cart is empty.</Text>
      </View>
    );
  }

  async function placeOrder() {
    if (stores.length === 0) return;
    const name = contactName.trim();
    const phoneVal = phone.trim();
    if (!name || !phoneVal) {
      setError("Contact name and phone are required for pickup.");
      return;
    }
    const noteParts = [
      `Pickup contact: ${name}`,
      `Phone: ${phoneVal}`,
      pickupNotes.trim() ? `Notes: ${pickupNotes.trim()}` : null,
    ].filter(Boolean);
    const notes = noteParts.join(" · ");

    setBusy(true);
    setError(null);
    const snapshot = [...stores];
    let placed = 0;
    const failed: string[] = [];

    try {
      for (const store of snapshot) {
        try {
          await api("/portal/orders", {
            method: "POST",
            body: JSON.stringify({
              business_id: store.businessId,
              payment_method: payMethod,
              notes,
              items: store.lines.map((l) => ({
                product_id: l.productId,
                quantity: l.quantity,
              })),
            }),
          });
          placed += 1;
          clearStore(store.businessId);
        } catch (err) {
          failed.push(
            `${store.businessName}: ${err instanceof Error ? err.message : "Failed"}`
          );
        }
      }

      if (failed.length === 0) {
        clear();
        toast.success(
          placed === 1 ? "Order placed" : `${placed} orders placed`
        );
        router.replace("/app/sales");
        return;
      }

      if (placed > 0) {
        toast.success(`${placed} order(s) placed; ${failed.length} failed`);
      }
      setError(failed.join(" · "));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <BuyerNav />
      <Text style={styles.title}>Contact & payment</Text>
      <Text style={styles.sub}>
        {stores.length === 1
          ? `Pickup from ${stores[0].businessName}`
          : `${stores.length} store pickups`}{" "}
        · Rs {subtotal.toFixed(2)}
      </Text>
      {stores.length > 1 ? (
        <View style={styles.summary}>
          {stores.map((s) => {
            const total = s.lines.reduce((a, l) => a + l.quantity * l.price, 0);
            return (
              <Text key={s.businessId} style={styles.summaryRow}>
                {s.businessName} · Rs {total.toFixed(2)}
              </Text>
            );
          })}
          <Text style={styles.hint}>
            Each store is a separate pickup order with the same contact details.
          </Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={contactName}
        onChangeText={setContactName}
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>Pickup notes</Text>
      <TextInput
        style={[styles.input, { minHeight: 72 }]}
        value={pickupNotes}
        onChangeText={setPickupNotes}
        multiline
        placeholder="e.g. ready after 5pm"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Payment</Text>
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
        style={[styles.cta, busy && { opacity: 0.5 }]}
        disabled={busy}
        onPress={() => void placeOrder()}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.ctaText}>
            {stores.length > 1 ? `Place ${stores.length} orders` : "Place order"}
          </Text>
        )}
      </Pressable>
      <Link href="/app/checkout" asChild>
        <Pressable>
          <Text style={styles.back}>← Back to cart</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  empty: { color: colors.body, marginTop: 24 },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading },
  sub: { color: colors.body, marginBottom: 12, marginTop: 4 },
  summary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  summaryRow: { color: colors.heading, fontWeight: "600", fontSize: 13 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  error: { color: colors.danger, marginBottom: 8 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.heading,
    backgroundColor: colors.card,
  },
  payRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  payBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  payText: { color: colors.heading, textTransform: "capitalize", fontWeight: "600" },
  payTextOn: { color: colors.white },
  cta: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: colors.white, fontWeight: "700" },
  back: { color: colors.brand, fontWeight: "700", marginTop: 14, textAlign: "center" },
});
