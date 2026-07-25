import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import BuyerNav from "./BuyerNav";
import { BuyerOrderDetailSkeleton, BuyerOrderListSkeleton } from "./BuyerSkeletons";

type Order = {
  id: string;
  invoice_number: string;
  total_amount: string;
  inserted_at?: string;
  status: string;
  source?: string;
  business_name?: string | null;
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

/** Buyer view of `/app/sales`. */
export default function BuyerOrders() {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void api<{ data: Order[] }>("/portal/orders")
      .then((res) => {
        setOrders(res.data || []);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    void api<{ data: Order }>(`/portal/orders/${detailId}`)
      .then((res) => setDetail(res.data))
      .catch((err) =>
        setDetailError(err instanceof Error ? err.message : "Failed to load order")
      )
      .finally(() => setDetailLoading(false));
  }, [detailId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>Order history</Text>
      <Text style={styles.hint}>Track pickup orders — tap for line items and totals.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <BuyerOrderListSkeleton />
      ) : orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyBody}>
            Browse Discover and place your first pickup order.
          </Text>
          <Link href="/app/dashboard" asChild>
            <Pressable style={styles.cta}>
              <Text style={styles.ctaText}>Browse stores</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        orders.map((o) => (
          <Pressable
            key={o.id}
            style={styles.card}
            onPress={() => setDetailId(o.id)}
          >
            <View style={[styles.accent, { backgroundColor: palette.brand }]} />
            <View style={styles.cardBody}>
              <View style={styles.row}>
                <Text style={styles.invoice}>{o.invoice_number}</Text>
                <Text style={styles.amount}>Rs {o.total_amount}</Text>
              </View>
              <View style={styles.badgeRow}>
                <Text style={[styles.badge, { backgroundColor: palette.brandSoft, color: palette.brand }]}>
                  {o.status}
                </Text>
                {o.source === "online" ? (
                  <Text style={styles.badgeMuted}>Online</Text>
                ) : null}
              </View>
              <Text style={styles.meta}>
                {o.business_name ? `${o.business_name} · ` : ""}
                {o.inserted_at ? new Date(o.inserted_at).toLocaleString() : ""}
              </Text>
              <Text style={[styles.tapHint, { color: palette.brand }]}>View details →</Text>
            </View>
          </Pressable>
        ))
      )}

      <Modal
        visible={!!detailId}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Order detail</Text>
              <Pressable onPress={() => setDetailId(null)} hitSlop={12}>
                <Text style={{ color: palette.brand, fontWeight: "700" }}>Close</Text>
              </Pressable>
            </View>
            {detailLoading ? (
              <BuyerOrderDetailSkeleton />
            ) : detailError ? (
              <Text style={styles.error}>{detailError}</Text>
            ) : detail ? (
              <ScrollView style={{ maxHeight: 480 }}>
                <Text style={styles.invoice}>{detail.invoice_number}</Text>
                <Text style={styles.meta}>
                  {detail.business_name || "Store"}
                  {detail.inserted_at
                    ? ` · ${new Date(detail.inserted_at).toLocaleString()}`
                    : ""}
                </Text>
                <View style={styles.badgeRow}>
                  <Text
                    style={[
                      styles.badge,
                      { backgroundColor: palette.brandSoft, color: palette.brand },
                    ]}
                  >
                    {detail.status}
                  </Text>
                </View>
                <Text style={styles.section}>Items</Text>
                {(detail.items || []).length === 0 ? (
                  <Text style={styles.meta}>No line items.</Text>
                ) : (
                  (detail.items || []).map((line, idx) => (
                    <View key={idx} style={styles.lineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineName}>{line.name || "Item"}</Text>
                        <Text style={styles.meta}>
                          {line.quantity} × Rs {line.unit_price}
                        </Text>
                      </View>
                      <Text style={styles.amount}>Rs {line.line_total}</Text>
                    </View>
                  ))
                )}
                <View style={styles.totalBlock}>
                  {detail.subtotal != null ? (
                    <View style={styles.totalRow}>
                      <Text style={styles.meta}>Subtotal</Text>
                      <Text style={styles.meta}>Rs {detail.subtotal}</Text>
                    </View>
                  ) : null}
                  <View style={styles.totalRow}>
                    <Text style={styles.invoice}>Total</Text>
                    <Text style={styles.invoice}>Rs {detail.total_amount}</Text>
                  </View>
                </View>
                {(detail.payments || []).map((p, i) => (
                  <Text key={i} style={styles.meta}>
                    {p.method}: Rs {p.amount}
                  </Text>
                ))}
                {detail.notes ? (
                  <Text style={[styles.meta, { marginTop: 8 }]}>Notes: {detail.notes}</Text>
                ) : null}
              </ScrollView>
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
    title: { fontSize: 26, fontWeight: "800", color: colors.heading, letterSpacing: -0.3 },
    hint: { color: colors.body, marginTop: 4, marginBottom: 16 },
    error: { color: colors.danger, marginBottom: 8 },
    emptyCard: {
      backgroundColor: palette.brandLight || palette.brandSoft,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.brand,
      padding: 22,
      alignItems: "center",
    },
    emptyTitle: { fontWeight: "800", color: colors.heading, fontSize: 17 },
    emptyBody: {
      color: colors.body,
      marginTop: 6,
      textAlign: "center",
      marginBottom: 14,
    },
    cta: {
      backgroundColor: palette.brand,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    ctaText: { color: palette.brandForeground, fontWeight: "700" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      flexDirection: "row",
      overflow: "hidden",
    },
    accent: { width: 4 },
    cardBody: { flex: 1, padding: 14 },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    invoice: { fontWeight: "800", color: colors.heading, flexShrink: 1 },
    amount: { fontWeight: "800", color: colors.heading },
    badgeRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
    badge: {
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
    meta: { marginTop: 6, color: colors.body, fontSize: 13 },
    tapHint: { marginTop: 8, fontWeight: "700", fontSize: 13 },
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
      paddingBottom: 32,
      maxHeight: "88%",
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.heading },
    section: {
      marginTop: 16,
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
    totalBlock: { marginTop: 14, gap: 6 },
    totalRow: { flexDirection: "row", justifyContent: "space-between" },
  });
}
