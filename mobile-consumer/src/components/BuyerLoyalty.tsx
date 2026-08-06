import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { portalKeys } from "../lib/queryClient";
import BuyerNav from "./BuyerNav";
import { BuyerEmptyPanel, BuyerHero } from "./BuyerLayout";
import { BuyerLoyaltySkeleton } from "./BuyerSkeletons";
import { t } from "../lib/i18n";
import { formatDecimal } from "../lib/decimal";

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
  const [selected, setSelected] = useState<LoyaltyRow | null>(null);

  const loyaltyQuery = useQuery({
    queryKey: portalKeys.loyalty(),
    queryFn: async () => {
      const res = await api<{ data: LoyaltyRow[] }>("/portal/loyalty");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const rows: LoyaltyRow[] = loyaltyQuery.data ?? [];
  const loading = loyaltyQuery.isLoading;
  const errorMessage =
    loyaltyQuery.error instanceof Error
      ? loyaltyQuery.error.message
      : loyaltyQuery.error
        ? "Failed to load"
        : null;
  const total = rows.reduce((s: number, r: LoyaltyRow) => s + (r.points || 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerLoyaltyTitle")}
        description={t("pages.buyerLoyaltyDesc")}
      />
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {loading ? (
        <BuyerLoyaltySkeleton />
      ) : rows.length === 0 ? (
        <BuyerEmptyPanel
          title={t("marketplace.emptyLoyaltyTitle")}
          body={t("marketplace.emptyLoyaltyBody")}
        />
      ) : (
        <>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>{t("marketplace.totalPoints")}</Text>
            <Text style={styles.kpiValue}>{total}</Text>
            <Text style={styles.meta}>{t("marketplace.acrossStores")}</Text>
          </View>
          {rows.map((row) => (
            <Pressable
              key={row.business_id}
              style={styles.card}
              onPress={() => setSelected(row)}
            >
              <View style={styles.row}>
                <Text style={styles.biz}>
                  {row.business_name || t("marketplace.store")}
                </Text>
                {row.tier ? <Text style={styles.tier}>{row.tier.name}</Text> : null}
              </View>
              <Text style={styles.points}>{row.points}</Text>
              <Text style={styles.meta}>{t("marketplace.points")}</Text>
              <Text style={[styles.tap, { color: palette.brand }]}>
                {t("marketplace.viewDetails")} →
              </Text>
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
                {selected?.business_name || t("marketplace.store")}
              </Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                <Text style={{ color: palette.brand, fontWeight: "700" }}>
                  {t("common.close")}
                </Text>
              </Pressable>
            </View>
            {selected ? (
              <>
                <Text style={styles.points}>{selected.points}</Text>
                <Text style={styles.meta}>{t("marketplace.points")}</Text>
                {selected.tier ? (
                  <Text style={[styles.tier, { alignSelf: "flex-start", marginTop: 8 }]}>
                    {selected.tier.name}
                  </Text>
                ) : null}
                <Text style={styles.section}>{t("marketplace.earnRate")}</Text>
                <Text style={styles.hintCard}>
                  {selected.rates.points_per_earn} pt per Rs{" "}
                  {formatDecimal(selected.rates.earn_per_amount)}
                </Text>
                <Text style={styles.section}>{t("marketplace.redeemValue")}</Text>
                <Text style={styles.hintCard}>
                  Rs {formatDecimal(selected.rates.redeem_value)} per point
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
    error: { color: colors.danger, marginBottom: 8 },
    kpi: {
      backgroundColor: colors.card,
      borderRadius: colors.radiusLg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    kpiLabel: { color: colors.body, fontWeight: "600" },
    kpiValue: { marginTop: 4, fontSize: 32, fontWeight: "800", color: colors.heading },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radiusLg,
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
