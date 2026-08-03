import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { t } from "../lib/i18n";
import { pushPath } from "../lib/nav";
import { BuyerCard, BuyerEmptyPanel } from "../components/BuyerLayout";
import { BuyerOrderDetailSkeleton } from "../components/BuyerSkeletons";
import { formatDecimal } from "../lib/decimal";

type Order = {
  id: string;
  invoice_number: string;
  total_amount: string;
  inserted_at?: string;
  status: string;
  source?: string;
  business_name?: string | null;
  business_id?: string;
  subtotal?: string;
  tax_amount?: string;
  discount_amount?: string;
  notes?: string | null;
  items?: {
    name?: string | null;
    quantity: string;
    unit_price: string;
    line_total: string;
  }[];
  payments?: { method: string; amount: string }[];
};

/** Pushed order detail screen. */
export default function OrderDetailScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const { id } = (route.params || {}) as { id: string };
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError(t("common.loadFailed"));
      setLoading(false);
      return;
    }
    setLoading(true);
    void api<{ data: Order }>(`/portal/orders/${id}`)
      .then((res) => {
        setOrder(res.data);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("common.loadFailed"))
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <BuyerOrderDetailSkeleton />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: palette.brand }]}>
            {t("marketplace.backToOrders")}
          </Text>
        </Pressable>
        <BuyerEmptyPanel
          title={t("marketplace.orderDetail")}
          body={error || t("common.loadFailed")}
          actionLabel={t("marketplace.backToOrders")}
          onAction={() => pushPath(navigation, "/app/sales")}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={[styles.back, { color: palette.brand }]}>
          ← {t("marketplace.backToOrders")}
        </Text>
      </Pressable>

      <BuyerCard>
        <View style={[styles.header, { backgroundColor: palette.brandSoft }]}>
          <Text style={styles.eyebrow}>{t("marketplace.orderDetailTitle")}</Text>
          <Text style={styles.invoice}>{order.invoice_number}</Text>
          <Text style={styles.meta}>
            {order.business_name || t("marketplace.store")}
            {order.inserted_at
              ? ` · ${new Date(order.inserted_at).toLocaleString()}`
              : ""}
          </Text>
          <View style={styles.badgeRow}>
            <Text
              style={[
                styles.badge,
                { backgroundColor: palette.brand, color: palette.brandForeground },
              ]}
            >
              {order.status}
            </Text>
            {order.source === "online" ? (
              <Text style={styles.badgeMuted}>{t("marketplace.onlineBadge")}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.section}>{t("marketplace.items")}</Text>
          {(order.items || []).length === 0 ? (
            <Text style={styles.meta}>{t("marketplace.noLineItems")}</Text>
          ) : (
            (order.items || []).map((line, idx) => (
              <View key={idx} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{line.name || t("marketplace.item")}</Text>
                  <Text style={styles.meta}>
                    {line.quantity} × Rs {formatDecimal(line.unit_price)}
                  </Text>
                </View>
                <Text style={styles.amount}>Rs {formatDecimal(line.line_total)}</Text>
              </View>
            ))
          )}

          <View style={styles.totalBlock}>
            {order.subtotal != null ? (
              <View style={styles.totalRow}>
                <Text style={styles.meta}>{t("common.subtotal")}</Text>
                <Text style={styles.meta}>Rs {formatDecimal(order.subtotal)}</Text>
              </View>
            ) : null}
            {order.tax_amount != null && Number(order.tax_amount) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.meta}>{t("marketplace.tax")}</Text>
                <Text style={styles.meta}>Rs {formatDecimal(order.tax_amount)}</Text>
              </View>
            ) : null}
            {order.discount_amount != null && Number(order.discount_amount) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.meta}>{t("marketplace.discount")}</Text>
                <Text style={styles.meta}>Rs {formatDecimal(order.discount_amount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.invoice}>{t("common.total")}</Text>
              <Text style={styles.invoice}>Rs {formatDecimal(order.total_amount)}</Text>
            </View>
          </View>

          {(order.payments || []).map((p, i) => (
            <Text key={i} style={styles.meta}>
              {p.method}: Rs {formatDecimal(p.amount)}
            </Text>
          ))}
          {order.notes ? (
            <Text style={[styles.meta, { marginTop: 8 }]}>
              {t("marketplace.notes")}: {order.notes}
            </Text>
          ) : null}

          {order.business_id ? (
            <Pressable
              style={[styles.visitBtn, { borderColor: palette.brand }]}
              onPress={() => pushPath(navigation, `/app/market/${order.business_id}`)}
            >
              <Text style={[styles.visitText, { color: palette.brand }]}>
                {t("marketplace.visitStore")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </BuyerCard>
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgPrimary },
    container: { padding: 16, paddingBottom: 40 },
    back: { fontWeight: "700", marginBottom: 12 },
    header: { padding: 16, gap: 6 },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    invoice: { fontWeight: "800", color: colors.heading, fontSize: 18 },
    meta: { color: colors.body, fontSize: 13 },
    badgeRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
    badge: {
      overflow: "hidden",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 11,
      fontWeight: "700",
    },
    badgeMuted: {
      backgroundColor: colors.bgSecondary,
      color: colors.body,
      overflow: "hidden",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 11,
      fontWeight: "700",
    },
    body: { padding: 16, gap: 4 },
    section: {
      marginBottom: 8,
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    lineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lineName: { fontWeight: "700", color: colors.heading },
    amount: { fontWeight: "800", color: colors.heading },
    totalBlock: { marginTop: 14, gap: 6 },
    totalRow: { flexDirection: "row", justifyContent: "space-between" },
    visitBtn: {
      marginTop: 16,
      borderWidth: 1,
      borderRadius: colors.radiusLg,
      paddingVertical: 12,
      alignItems: "center",
    },
    visitText: { fontWeight: "700" },
  });
}
