import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { t } from "../lib/i18n";
import { pushPath } from "../lib/nav";
import { useToast } from "../components/Toast";
import { BuyerCard } from "../components/BuyerLayout";
import {
  BuyerDetailErrorState,
  BuyerDetailLoadingState,
  BuyerDetailScrollLayout,
} from "../components/BuyerScreenScaffold";

type Appointment = {
  id: string;
  business_id: string;
  business_name?: string | null;
  product_name?: string | null;
  product_id?: string | null;
  staff_name?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  notes?: string | null;
  duration_minutes?: number | null;
};

function canCancel(status: string) {
  return status === "Booked";
}

/** Pushed appointment detail — resolves from portal list until a show route ships. */
export default function AppointmentDetailScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const { id } = (route.params || {}) as { id: string };
  const palette = useBrandPalette();
  const toast = useToast();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    void api<{ data: Appointment[] }>("/portal/appointments")
      .then((res) => {
        const found = (res.data || []).find((a) => a.id === id) || null;
        setAppt(found);
        setError(found ? null : t("appointments.detailNotFound"));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("appointments.loadFailed"))
      )
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function cancelAppointment() {
    if (!appt) return;
    setCancelling(true);
    try {
      const res = await api<{ data: Appointment }>(
        `/portal/appointments/${appt.id}/cancel`,
        { method: "POST", body: "{}" }
      );
      setAppt(res.data);
      toast.success(t("appointments.cancelled"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("appointments.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <BuyerDetailLoadingState />;
  }

  if (error && !appt) {
    return (
      <BuyerDetailErrorState
        backLabel={t("marketplace.backToOrders")}
        onBack={() => navigation.goBack()}
        backColor={palette.brand}
        title={t("appointments.detailNotFound")}
        body={t("appointments.detailNotFoundBody")}
        actionLabel={t("marketplace.backToOrders")}
        onAction={() => pushPath(navigation, "/app/sales")}
      />
    );
  }

  if (!appt) return null;

  const endTime = appt.ends_at
    ? new Date(appt.ends_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <BuyerDetailScrollLayout
      backLabel={t("marketplace.backToOrders")}
      onBack={() => navigation.goBack()}
      backColor={palette.brand}
    >
      <BuyerCard>
        <View style={[styles.header, { backgroundColor: palette.brandSoft }]}>
          <Text style={styles.eyebrow}>{t("appointments.tabAppointments")}</Text>
          <Text style={styles.title}>
            {appt.product_name || t("appointments.service")}
          </Text>
          <Text style={styles.meta}>
            {appt.business_name || t("marketplace.store")}
          </Text>
          <Text
            style={[
              styles.badge,
              { backgroundColor: palette.brand, color: palette.brandForeground },
            ]}
          >
            {appt.status}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={styles.dt}>{t("appointments.time")}</Text>
            <Text style={styles.dd}>
              {appt.starts_at ? new Date(appt.starts_at).toLocaleString() : "—"}
              {endTime ? ` – ${endTime}` : ""}
            </Text>
          </View>
          {appt.duration_minutes ? (
            <View style={styles.row}>
              <Text style={styles.dt}>{t("appointments.duration")}</Text>
              <Text style={styles.dd}>
                {t("appointments.minutes", { count: appt.duration_minutes })}
              </Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.dt}>{t("appointments.staff")}</Text>
            <Text style={styles.dd}>
              {appt.staff_name || t("appointments.anyStaff")}
            </Text>
          </View>
          {appt.notes ? (
            <View style={styles.row}>
              <Text style={styles.dt}>{t("marketplace.notes")}</Text>
              <Text style={[styles.dd, { flex: 1, textAlign: "right" }]}>
                {appt.notes}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {appt.business_id ? (
              <Pressable
                style={[styles.btn, { backgroundColor: palette.brand }]}
                onPress={() => pushPath(navigation, `/app/market/${appt.business_id}`)}
              >
                <Text style={[styles.btnText, { color: palette.brandForeground }]}>
                  {t("marketplace.visitStore")}
                </Text>
              </Pressable>
            ) : null}
            {canCancel(appt.status) ? (
              <Pressable
                style={[styles.btnOutline, cancelling && { opacity: 0.6 }]}
                disabled={cancelling}
                onPress={() => void cancelAppointment()}
              >
                {cancelling ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={styles.cancelText}>{t("appointments.cancel")}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </BuyerCard>
    </BuyerDetailScrollLayout>
  );
}

function createStyles(_palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    header: { padding: 16, gap: 6 },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    title: { fontSize: 22, fontWeight: "800", color: colors.heading },
    meta: { color: colors.body, fontSize: 14 },
    badge: {
      alignSelf: "flex-start",
      overflow: "hidden",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 4,
    },
    body: { padding: 16, gap: 12 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dt: { color: colors.body, fontSize: 14 },
    dd: { fontWeight: "700", color: colors.heading, fontSize: 14, maxWidth: "60%" },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
    btn: {
      borderRadius: colors.radiusLg,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    btnText: { fontWeight: "700" },
    btnOutline: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: colors.radiusLg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minWidth: 100,
      alignItems: "center",
    },
    cancelText: { color: colors.danger, fontWeight: "700" },
  });
}
