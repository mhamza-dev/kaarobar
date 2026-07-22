import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api, colors } from "../lib/api";
import BuyerNav from "./BuyerNav";

type LoyaltyRow = {
  business_id: string;
  business_name?: string;
  points: number;
  tier?: { name: string } | null;
  rates: { earn_per_amount: string; points_per_earn: number; redeem_value: string };
};

/** Buyer view of `/customers`. */
export default function BuyerLoyalty() {
  const [rows, setRows] = useState<LoyaltyRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ data: LoyaltyRow[] }>("/portal/loyalty")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>Loyalty</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rows.length === 0 ? (
        <Text style={styles.empty}>No loyalty balances yet — order from a store first.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.business_id} style={styles.card}>
            <Text style={styles.biz}>{row.business_name}</Text>
            <Text style={styles.points}>{row.points}</Text>
            <Text style={styles.meta}>points</Text>
            {row.tier ? (
              <Text style={styles.tier}>Tier: {row.tier.name}</Text>
            ) : null}
            <Text style={styles.hint}>
              Earn {row.rates.points_per_earn} pt per Rs {row.rates.earn_per_amount}. Redeem
              value Rs {row.rates.redeem_value} / pt.
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
    padding: 16,
    marginBottom: 12,
  },
  biz: { fontWeight: "700", color: colors.brand },
  points: { marginTop: 8, fontSize: 36, fontWeight: "800", color: colors.heading },
  meta: { color: colors.body },
  tier: { marginTop: 10, fontWeight: "700", color: colors.brand },
  hint: { marginTop: 10, color: colors.body, fontSize: 13 },
});
