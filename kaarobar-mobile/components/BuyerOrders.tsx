import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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

/** Buyer view of `/sales`. */
export default function BuyerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ data: Order[] }>("/portal/orders")
      .then((res) => setOrders(res.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>Order history</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {orders.length === 0 ? (
        <Text style={styles.empty}>No orders yet.</Text>
      ) : (
        orders.map((o) => (
          <View key={o.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.invoice}>{o.invoice_number}</Text>
              <Text style={styles.amount}>Rs {o.total_amount}</Text>
            </View>
            <Text style={styles.meta}>
              {o.business_name ? `${o.business_name} · ` : ""}
              {o.inserted_at ? String(o.inserted_at).slice(0, 16) : ""} · {o.status}
              {o.source === "online" ? " · online" : ""}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading, marginBottom: 12 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.body },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  invoice: { fontWeight: "700", color: colors.heading, flex: 1 },
  amount: { fontWeight: "800", color: colors.heading },
  meta: { marginTop: 6, color: colors.body, fontSize: 13 },
});
