import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, colors } from "../lib/api";
import BuyerNav from "./BuyerNav";

type Order = {
  id: string;
  invoice_number: string;
  total_amount: string;
  inserted_at?: string;
  status: string;
  source?: string;
  business_name?: string | null;
};

/** Buyer view of `/app/sales`. */
export default function BuyerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<{ data: Order[] }>("/portal/orders")
      .then((res) => setOrders(res.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>Order history</Text>
      <Text style={styles.hint}>Track pickup orders from marketplace stores.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />
      ) : orders.length === 0 ? (
        <Text style={styles.empty}>No orders yet — browse Discover to place one.</Text>
      ) : (
        orders.map((o) => (
          <View key={o.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.invoice}>{o.invoice_number}</Text>
              <Text style={styles.amount}>Rs {o.total_amount}</Text>
            </View>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{o.status}</Text>
              {o.source === "online" ? <Text style={styles.badgeMuted}>Online</Text> : null}
            </View>
            <Text style={styles.meta}>
              {o.business_name ? `${o.business_name} · ` : ""}
              {o.inserted_at ? new Date(o.inserted_at).toLocaleString() : ""}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading },
  hint: { color: colors.body, marginTop: 4, marginBottom: 14 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.body },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  invoice: { fontWeight: "800", color: colors.heading, flex: 1 },
  amount: { fontWeight: "800", color: colors.heading },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  badge: {
    backgroundColor: colors.brandSoft || "#CCFBF1",
    color: colors.brand,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  badgeMuted: {
    backgroundColor: colors.bgSecondary || "#F1F5F9",
    color: colors.body,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  meta: { marginTop: 8, color: colors.body, fontSize: 13 },
});
