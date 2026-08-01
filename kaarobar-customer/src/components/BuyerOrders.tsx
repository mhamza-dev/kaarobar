import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { BuyerEmptyPanel, BuyerHero } from "./BuyerLayout";
import { BuyerOrderListSkeleton } from "./BuyerSkeletons";
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
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerOrdersTitle")}
        description={t("pages.buyerOrdersDesc")}
      />

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
          <BuyerEmptyPanel
            title={t("marketplace.emptyOrdersTitle")}
            body={t("marketplace.emptyOrdersBody")}
            actionLabel={t("marketplace.browseStores")}
            onAction={() => pushPath(navigation, "/app/dashboard")}
          />
        ) : (
          orders.map((o) => (
            <Pressable
              key={o.id}
              style={styles.card}
              onPress={() => pushPath(navigation, `/app/sales/${o.id}`)}
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
                <Text style={[styles.tap, { color: palette.brand }]}>
                  {t("marketplace.viewDetails")} →
                </Text>
              </View>
            </Pressable>
          ))
        )
      ) : upcoming.length === 0 && past.length === 0 ? (
        <BuyerEmptyPanel
          title={t("appointments.emptyTitle")}
          body={t("appointments.emptyBody")}
          actionLabel={t("marketplace.browseStores")}
          onAction={() => pushPath(navigation, "/app/dashboard")}
        />
      ) : (
        <View style={{ gap: 16 }}>
          {upcoming.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>{t("appointments.upcoming")}</Text>
              {upcoming.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.card}
                  onPress={() =>
                    pushPath(navigation, `/app/sales/appointments/${a.id}`)
                  }
                >
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
                        onPress={(e) => {
                          e.stopPropagation?.();
                          void cancelAppointment(a.id);
                        }}
                      >
                        {cancellingId === a.id ? (
                          <ActivityIndicator color={colors.danger} size="small" />
                        ) : (
                          <Text style={styles.cancelText}>{t("appointments.cancel")}</Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {past.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>{t("appointments.past")}</Text>
              {past.map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.card, { opacity: 0.85 }]}
                  onPress={() =>
                    pushPath(navigation, `/app/sales/appointments/${a.id}`)
                  }
                >
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
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
    error: { color: colors.danger, marginBottom: 8 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radiusLg,
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
    tap: { marginTop: 8, fontWeight: "700", fontSize: 13 },
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
  });
}
