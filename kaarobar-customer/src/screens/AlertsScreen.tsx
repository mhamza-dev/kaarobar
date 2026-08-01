import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { t } from "../lib/i18n";
import { useToast } from "../components/Toast";
import { BuyerCard, BuyerEmptyPanel, BuyerHero } from "../components/BuyerLayout";

type Note = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  status: string;
  read_at?: string | null;
  inserted_at: string;
};

/** Portal notifications under Account. */
export default function AlertsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const toast = useToast();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [items, setItems] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Note[]; meta?: { unread?: number } }>(
        "/portal/notifications"
      );
      setItems(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("notifications.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) =>
      `${n.title ?? ""} ${n.type} ${n.body ?? ""} ${n.status}`
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  async function markRead(id: string) {
    try {
      await api(`/portal/notifications/${id}/read`, { method: "POST" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await api(`/portal/notifications/read-all`, { method: "POST" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={[styles.back, { color: palette.brand }]}>
          ← {t("pages.buyerAccountTitle")}
        </Text>
      </Pressable>

      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("nav.notifications")}
        description={t("pages.buyerNotificationsDesc")}
      />

      <TextInput
        style={styles.search}
        placeholder={t("notifications.searchPlaceholder")}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
      />

      {unread > 0 ? (
        <Pressable
          style={[styles.markAll, { borderColor: palette.brand }]}
          disabled={busy}
          onPress={() => void markAllRead()}
        >
          {busy ? (
            <ActivityIndicator color={palette.brand} />
          ) : (
            <Text style={[styles.markAllText, { color: palette.brand }]}>
              {t("common.markRead")} ({unread})
            </Text>
          )}
        </Pressable>
      ) : null}

      {loading ? (
        <ActivityIndicator color={palette.brand} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <BuyerEmptyPanel
          title={
            items.length === 0
              ? t("notifications.empty")
              : t("notifications.noMatching")
          }
        />
      ) : (
        filtered.map((n) => {
          const unreadItem = !n.read_at;
          return (
            <BuyerCard
              key={n.id}
              style={[styles.card, unreadItem ? { borderColor: palette.brand } : null]}
            >
              <Pressable
                style={styles.cardPress}
                onPress={() => {
                  if (unreadItem) void markRead(n.id);
                }}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {n.title || n.type}
                  </Text>
                  {unreadItem ? (
                    <View style={[styles.dot, { backgroundColor: palette.brand }]} />
                  ) : null}
                </View>
                {n.body ? (
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {n.body}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {new Date(n.inserted_at).toLocaleString()}
                </Text>
              </Pressable>
            </BuyerCard>
          );
        })
      )}
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgPrimary },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    back: { fontWeight: "700", marginBottom: 4 },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: colors.radiusLg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.heading,
    },
    markAll: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    markAllText: { fontWeight: "700", fontSize: 13 },
    card: { marginBottom: 0 },
    cardPress: { padding: 14, gap: 6 },
    cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    cardTitle: { flex: 1, fontWeight: "800", color: colors.heading, fontSize: 15 },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    cardBody: { color: colors.body, fontSize: 13, lineHeight: 18 },
    meta: { color: colors.muted, fontSize: 12 },
  });
}
