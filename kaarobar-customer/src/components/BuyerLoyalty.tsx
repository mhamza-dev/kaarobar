import { useEffect, useMemo, useState } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors } from "../lib/api";
import BuyerNav from "./BuyerNav";
import { BuyerLoyaltySkeleton } from "./BuyerSkeletons";

type LoyaltyRow = {
  business_id: string;
  business_name?: string;
  points: number;
  tier?: { name: string } | null;
  rates: { earn_per_amount: string; points_per_earn: number; redeem_value: string };
};

/** Buyer view of `/app/customers`. */
export default function BuyerLoyalty() {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [rows, setRows] = useState<LoyaltyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LoyaltyRow | null>(null);

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
      <Text style={styles.hint}>Points and tiers — tap a store for earn/redeem rates.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <BuyerLoyaltySkeleton />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No loyalty balances yet — order from a store first.</Text>
      ) : (
        <>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Total points</Text>
            <Text style={styles.kpiValue}>{total}</Text>
          </View>
          {rows.map((row) => (
            <Pressable
              key={row.business_id}
              style={styles.card}
              onPress={() => setSelected(row)}
            >
              <View style={styles.row}>
                <Text style={styles.biz}>{row.business_name || "Store"}</Text>
                {row.tier ? <Text style={styles.tier}>{row.tier.name}</Text> : null}
              </View>
              <Text style={styles.points}>{row.points}</Text>
              <Text style={styles.meta}>points</Text>
              <Text style={[styles.tap, { color: palette.brand }]}>View details →</Text>
            </Pressable>
          ))}
        </>
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {selected?.business_name || "Store"}
              </Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                <Text style={{ color: palette.brand, fontWeight: "700" }}>Close</Text>
              </Pressable>
            </View>
            {selected ? (
              <>
                <Text style={styles.points}>{selected.points}</Text>
                <Text style={styles.meta}>points</Text>
                {selected.tier ? (
                  <Text style={[styles.tier, { alignSelf: "flex-start", marginTop: 8 }]}>
                    {selected.tier.name}
                  </Text>
                ) : null}
                <Text style={styles.section}>Earn rate</Text>
                <Text style={styles.hintCard}>
                  {selected.rates.points_per_earn} pt per Rs {selected.rates.earn_per_amount}
                </Text>
                <Text style={styles.section}>Redeem value</Text>
                <Text style={styles.hintCard}>
                  Rs {selected.rates.redeem_value} per point
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
    title: { fontSize: 26, fontWeight: "800", color: colors.heading },
    hint: { color: colors.body, marginTop: 4, marginBottom: 14 },
    error: { color: colors.danger, marginBottom: 8 },
    empty: { color: colors.body },
    kpi: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    kpiLabel: { color: colors.body, fontWeight: "600" },
    kpiValue: { marginTop: 4, fontSize: 32, fontWeight: "800", color: colors.heading },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    biz: { fontWeight: "800", color: colors.heading, flex: 1 },
    tier: {
      backgroundColor: palette.brandSoft,
      color: palette.brand,
      overflow: "hidden",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 11,
      fontWeight: "700",
    },
    points: { marginTop: 10, fontSize: 36, fontWeight: "800", color: colors.heading },
    meta: { color: colors.body },
    tap: { marginTop: 10, fontWeight: "700", fontSize: 13 },
    hintCard: { color: colors.body, fontSize: 14 },
    section: {
      marginTop: 16,
      marginBottom: 4,
      fontSize: 11,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(15,23,42,0.45)",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 36,
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.heading, flex: 1 },
  });
}
