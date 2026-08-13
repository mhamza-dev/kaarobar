import {useCallback, useEffect, useState, useMemo } from "react";
import { type Theme, useTheme } from "@/theme";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, getSession } from "@/lib/api";
import { loadLocale, t } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { registerForPushNotifications } from "@/lib/push";
import { replacePath, pushPath } from "@/lib/nav";

type Note = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  read_at?: string | null;
  inserted_at: string;
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toast = useToast();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getSession();
      if (!s) {
        replacePath("/landing");
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
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <>
      {unread > 0 ? (
        <Pressable onPress={() => void markAll()} style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Text style={{ color: theme.brand, fontWeight: "700" }}>Mark all</Text>
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
            tintColor={theme.brand}
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

        <Pressable onPress={() => pushPath("/app/dashboard")}><Text style={styles.link}>
          Back to home →
        </Text></Pressable>
      </ScrollView>
    </>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bgPrimary, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bgPrimary },
  hint: { color: t.body, marginBottom: 12 },
  empty: { color: t.muted, marginTop: 24, textAlign: "center" },
  card: {
    backgroundColor: t.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { borderColor: t.brand },
  title: { fontWeight: "700", color: t.heading, fontSize: 16 },
  body: { marginTop: 6, color: t.body },
  meta: { marginTop: 8, color: t.muted, fontSize: 12 },
  btn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: t.brand,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnText: { color: t.white, fontWeight: "700" },
  link: { marginTop: 18, textAlign: "center", color: t.brand, fontWeight: "600" },
});
}
