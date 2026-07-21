import { useCallback, useEffect, useState } from "react";
import { Link, router, Stack } from "expo-router";
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

type Note = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  read_at?: string | null;
  inserted_at: string;
};

export default function NotificationsScreen() {
  const toast = useToast();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      const res = await api<{ data: Note[]; meta?: { unread?: number } }>("/notifications");
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
      await registerForPushNotifications().catch(() => null);
      await load();
    })();
  }, [load]);

  async function markRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function markAll() {
    try {
      await api("/notifications/read-all", { method: "POST" });
      await load();
      toast.success("All caught up");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t("nav.notifications"),
          headerRight: () =>
            unread > 0 ? (
              <Pressable onPress={() => void markAll()} style={{ marginRight: 8 }}>
                <Text style={{ color: colors.brand, fontWeight: "700" }}>Mark all</Text>
              </Pressable>
            ) : null,
        }}
      />
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
            tintColor={colors.brand}
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

        <Link href="/profile" style={styles.link}>
          Notification preferences →
        </Link>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
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
  cardUnread: { borderColor: colors.brand },
  title: { fontWeight: "700", color: colors.heading, fontSize: 16 },
  body: { marginTop: 6, color: colors.body },
  meta: { marginTop: 8, color: colors.muted, fontSize: 12 },
  btn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnText: { color: colors.white, fontWeight: "700" },
  link: { marginTop: 18, textAlign: "center", color: colors.brand, fontWeight: "600" },
});
