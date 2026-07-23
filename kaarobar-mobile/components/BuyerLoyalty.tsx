import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, colors } from "../lib/api";
import BuyerNav from "./BuyerNav";

type LoyaltyRow = {
  business_id: string;
  business_name?: string;
  points: number;
  tier?: { name: string } | null;
  rates: { earn_per_amount: string; points_per_earn: number; redeem_value: string };
};

/** Buyer view of `/app/customers`. */
export default function BuyerLoyalty() {
  const [rows, setRows] = useState<LoyaltyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<{ data: LoyaltyRow[] }>("/portal/loyalty")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const total = rows.reduce((s, r) => s + (r.points || 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>Loyalty</Text>
      <Text style={styles.hint}>Points and tiers across stores you shop with.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No loyalty balances yet — order from a store first.</Text>
      ) : (
        <>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Total points</Text>
            <Text style={styles.kpiValue}>{total}</Text>
          </View>
          {rows.map((row) => (
            <View key={row.business_id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.biz}>{row.business_name || "Store"}</Text>
                {row.tier ? <Text style={styles.tier}>{row.tier.name}</Text> : null}
              </View>
              <Text style={styles.points}>{row.points}</Text>
              <Text style={styles.meta}>points</Text>
              <Text style={styles.hintCard}>
                Earn {row.rates.points_per_earn} pt per Rs {row.rates.earn_per_amount}. Redeem
                value Rs {row.rates.redeem_value} / pt.
              </Text>
            </View>
          ))}
        </>
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
  kpi: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  kpiLabel: { color: colors.body, fontWeight: "600" },
  kpiValue: { marginTop: 4, fontSize: 32, fontWeight: "800", color: colors.heading },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  biz: { fontWeight: "800", color: colors.heading, flex: 1 },
  tier: {
    backgroundColor: colors.brandSoft || "#CCFBF1",
    color: colors.brand,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  points: { marginTop: 10, fontSize: 36, fontWeight: "800", color: colors.heading },
  meta: { color: colors.body },
  hintCard: { marginTop: 10, color: colors.body, fontSize: 13 },
});
