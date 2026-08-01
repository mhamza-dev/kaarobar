import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { t } from "../lib/i18n";
import { useToast } from "./Toast";
import BuyerNav from "./BuyerNav";
import SegmentedTabs from "./SegmentedTabs";
import { BuyerOrderDetailSkeleton, BuyerOrderListSkeleton } from "./BuyerSkeletons";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { pushPath } from "../lib/nav";

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

type Appointment = {
  id: string;
  business_id: string;
  business_name?: string | null;
  product_name?: string | null;
  staff_name?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  duration_minutes?: number | null;
};

type Tab = "orders" | "appointments";

function isUpcoming(a: Appointment): boolean {
  const s = a.status.toLowerCase();
  if (["cancelled", "completed", "noshow"].includes(s)) return false;
  if (!a.starts_at) return true;
  return new Date(a.starts_at).getTime() >= Date.now() - 60 * 60 * 1000;
}

/** Buyer view of orders + appointments (CUS-FR-005). */
export default function BuyerOrders() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const toast = useToast();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void Promise.all([
      api<{ data: Order[] }>("/portal/orders"),
      api<{ data: Appointment[] }>("/portal/appointments").catch(() => ({
        data: [] as Appointment[],
      })),
    ])
      .then(([orderRes, apptRes]) => {
        setOrders(orderRes.data || []);
        setAppointments(apptRes.data || []);
        setError(null);
        const upcoming = (apptRes.data || []).filter(isUpcoming);
        if (upcoming.length > 0 && (orderRes.data || []).length === 0) {
          setTab("appointments");
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("common.loadFailed"))
      )
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
        setDetailError(err instanceof Error ? err.message : t("common.loadFailed"))
      )
      .finally(() => setDetailLoading(false));
  }, [detailId]);

  const upcoming = useMemo(
    () =>
      appointments
        .filter(isUpcoming)
        .sort((a, b) => (a.starts_at || "").localeCompare(b.starts_at || "")),
    [appointments]
  );

  const past = useMemo(
    () =>
      appointments
        .filter((a) => !isUpcoming(a))
        .sort((a, b) => (b.starts_at || "").localeCompare(a.starts_at || "")),
    [appointments]
  );

  async function cancelAppointment(id: string) {
    setCancellingId(id);
    try {
      await api(`/portal/appointments/${id}/cancel`, {
        method: "POST",
        body: "{}",
      });
      toast.success(t("appointments.cancelled"));
      load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("appointments.cancelFailed")
      );
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>{t("pages.buyerOrdersTitle")}</Text>
      <Text style={styles.hint}>{t("pages.buyerOrdersDesc")}</Text>

      <SegmentedTabs
        tabs={[
          {
            id: "orders" as const,
            label: `${t("appointments.tabOrders")}${orders.length ? ` (${orders.length})` : ""}`,
          },
          {
            id: "appointments" as const,
            label: `${t("appointments.tabAppointments")}${upcoming.length ? ` (${upcoming.length})` : ""}`,
          },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <BuyerOrderListSkeleton />
      ) : tab === "orders" ? (
        orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t("marketplace.emptyOrdersTitle")}</Text>
            <Text style={styles.emptyBody}>{t("marketplace.emptyOrdersBody")}</Text>
            <Pressable
              style={styles.cta}
              onPress={() => pushPath(navigation, "/app/dashboard")}
            >
              <Text style={styles.ctaText}>{t("marketplace.browseStores")}</Text>
            </Pressable>
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
                  <Text
                    style={[
                      styles.badge,
                      { backgroundColor: palette.brandSoft, color: palette.brand },
                    ]}
                  >
                    {o.status}
                  </Text>
                  {o.source === "online" ? (
                    <Text style={styles.badgeMuted}>{t("marketplace.onlineBadge")}</Text>
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  {o.business_name ? `${o.business_name} · ` : ""}
                  {o.inserted_at ? new Date(o.inserted_at).toLocaleString() : ""}
                </Text>
              </View>
            </Pressable>
          ))
        )
      ) : upcoming.length === 0 && past.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t("appointments.emptyTitle")}</Text>
          <Text style={styles.emptyBody}>{t("appointments.emptyBody")}</Text>
          <Pressable
            style={styles.cta}
            onPress={() => pushPath(navigation, "/app/dashboard")}
          >
            <Text style={styles.ctaText}>{t("marketplace.browseStores")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {upcoming.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>{t("appointments.upcoming")}</Text>
              {upcoming.map((a) => (
                <View key={a.id} style={styles.card}>
                  <View style={[styles.accent, { backgroundColor: palette.brand }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.row}>
                      <Text style={styles.invoice}>
                        {a.product_name || t("appointments.service")}
                      </Text>
                      <Text
                        style={[
                          styles.badge,
                          { backgroundColor: palette.brandSoft, color: palette.brand },
                        ]}
                      >
                        {a.status}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      {a.business_name ? `${a.business_name} · ` : ""}
                      {a.starts_at ? new Date(a.starts_at).toLocaleString() : ""}
                      {a.staff_name ? ` · ${a.staff_name}` : ""}
                    </Text>
                    {a.status === "Booked" ? (
                      <Pressable
                        style={[styles.cancelBtn, cancellingId === a.id && { opacity: 0.6 }]}
                        disabled={cancellingId === a.id}
                        onPress={() => void cancelAppointment(a.id)}
                      >
                        {cancellingId === a.id ? (
                          <ActivityIndicator color={colors.danger} size="small" />
                        ) : (
                          <Text style={styles.cancelText}>{t("appointments.cancel")}</Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {past.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>{t("appointments.past")}</Text>
              {past.map((a) => (
                <View key={a.id} style={[styles.card, { opacity: 0.85 }]}>
                  <View style={[styles.accent, { backgroundColor: colors.muted }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.row}>
                      <Text style={styles.invoice}>
                        {a.product_name || t("appointments.service")}
                      </Text>
                      <Text style={styles.badgeMuted}>{a.status}</Text>
                    </View>
                    <Text style={styles.meta}>
                      {a.business_name ? `${a.business_name} · ` : ""}
                      {a.starts_at ? new Date(a.starts_at).toLocaleString() : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
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
              <Text style={styles.sheetTitle}>{t("marketplace.orderDetail")}</Text>
              <Pressable onPress={() => setDetailId(null)} hitSlop={12}>
                <Text style={{ color: palette.brand, fontWeight: "700" }}>
                  {t("common.close")}
                </Text>
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
                <Text style={styles.section}>{t("marketplace.items")}</Text>
                {(detail.items || []).length === 0 ? (
                  <Text style={styles.meta}>{t("marketplace.noLineItems")}</Text>
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
                      <Text style={styles.meta}>{t("common.subtotal")}</Text>
                      <Text style={styles.meta}>Rs {detail.subtotal}</Text>
                    </View>
                  ) : null}
                  <View style={styles.totalRow}>
                    <Text style={styles.invoice}>{t("common.total")}</Text>
                    <Text style={styles.invoice}>Rs {detail.total_amount}</Text>
                  </View>
                </View>
                {(detail.payments || []).map((p, i) => (
                  <Text key={i} style={styles.meta}>
                    {p.method}: Rs {p.amount}
                  </Text>
                ))}
                {detail.notes ? (
                  <Text style={[styles.meta, { marginTop: 8 }]}>
                    Notes: {detail.notes}
                  </Text>
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
    hint: { color: colors.body, marginTop: 4, marginBottom: 12 },
    error: { color: colors.danger, marginBottom: 8 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
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
    row: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" },
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
    cancelBtn: {
      marginTop: 10,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    cancelText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
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
