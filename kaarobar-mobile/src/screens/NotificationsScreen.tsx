import {useCallback, useEffect, useState, useMemo } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors, getSession } from "../lib/api";
import { loadLocale, t } from "../lib/i18n";
import { useToast } from "../components/Toast";
import { registerForPushNotifications } from "../lib/push";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";

type Note = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  read_at?: string | null;
  inserted_at: string;
};

export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const toast = useToast();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      const base =
        s.actor === "consumer" ? "/portal/notifications" : "/notifications";
      const res = await api<{ data: Note[]; meta?: { unread?: number } }>(base);
      setItems(res.data || []);
      setUnread(res.meta?.unread ?? (res.data || []).filter((n) => !n.read_at).length);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (s?.actor !== "consumer") {
        await registerForPushNotifications().catch(() => null);
      }
      await load();
    })();
  }, [load]);

  async function markRead(id: string) {
    try {
      const s = await getSession();
      const base =
        s?.actor === "consumer" ? "/portal/notifications" : "/notifications";
      await api(`${base}/${id}/read`, { method: "POST" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function markAll() {
    try {
      const s = await getSession();
      const base =
        s?.actor === "consumer" ? "/portal/notifications" : "/notifications";
      await api(`${base}/read-all`, { method: "POST" });
      await load();
      toast.success("All caught up");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  return (
    <>
      {unread > 0 ? (
        <Pressable onPress={() => void markAll()} style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Text style={{ color: palette.brand, fontWeight: "700" }}>Mark all</Text>
        </Pressable>
      ) : null}
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={palette.brand}
          />
        }
      >
        <Text style={styles.hint}>
          {unread > 0 ? `${unread} unread` : t("pages.notificationsDesc") || "Your inbox"}
        </Text>

        {items.length === 0 ? (
          <Text style={styles.empty}>{t("notifications.empty") || "No notifications yet."}</Text>
        ) : (
          items.map((n) => (
            <View key={n.id} style={[styles.card, !n.read_at && styles.cardUnread]}>
              <Text style={styles.title}>{n.title || n.type}</Text>
              {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
              <Text style={styles.meta}>{new Date(n.inserted_at).toLocaleString()}</Text>
              {!n.read_at ? (
                <Pressable style={styles.btn} onPress={() => void markRead(n.id)}>
                  <Text style={styles.btnText}>Mark read</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}

        <Pressable onPress={() => pushPath(navigation, "/app/dashboard")}><Text style={styles.link}>
          Back to home →
        </Text></Pressable>
      </ScrollView>
    </>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary },
  hint: { color: colors.body, marginBottom: 12 },
  empty: { color: colors.muted, marginTop: 24, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { borderColor: palette.brand },
  title: { fontWeight: "700", color: colors.heading, fontSize: 16 },
  body: { marginTop: 6, color: colors.body },
  meta: { marginTop: 8, color: colors.muted, fontSize: 12 },
  btn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: palette.brand,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnText: { color: colors.white, fontWeight: "700" },
  link: { marginTop: 18, textAlign: "center", color: palette.brand, fontWeight: "600" },
});
}
