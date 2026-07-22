import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { api, colors, getSession } from "../../lib/api";
import { canAccessRoute } from "../../lib/rbac";
import { t } from "../../lib/i18n";

type Campaign = {
  id: string;
  name: string;
  title: string;
  message: string;
  audience: string;
  min_points?: number | null;
  status: string;
  sent_at?: string | null;
  recipient_count?: number;
  delivery?: { notified: number; email_only: number; skipped: number };
  recipients?: { id: string; customer_name?: string; channel_status: string }[];
};

export default function MarketingScreen() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({
    name: "",
    title: "",
    message: "",
    audience: "all",
    min_points: "",
  });
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Campaign[] }>("/crm/campaigns");
      setCampaigns(res.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/marketing")) {
        router.replace("/app/dashboard");
        return;
      }
      await load();
    })();
  }, [load]);

  async function create() {
    setBusy(true);
    try {
      await api("/crm/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          title: form.title,
          message: form.message,
          audience: form.audience,
          min_points:
            form.audience === "min_points" && form.min_points
              ? Number(form.min_points)
              : null,
        }),
      });
      setForm({ name: "", title: "", message: "", audience: "all", min_points: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function send(c: Campaign) {
    Alert.alert(t("marketing.send"), t("marketing.sendConfirm", { name: c.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Send",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const res = await api<{ data: Campaign }>(`/crm/campaigns/${c.id}/send`, {
                method: "POST",
                body: "{}",
              });
              setDetail(res.data);
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Send failed");
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>{t("pages.marketingTitle")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("marketing.newCampaign")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("marketing.internalName")}
          placeholderTextColor={colors.muted}
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
        />
        <TextInput
          style={styles.input}
          placeholder={t("marketing.notificationTitle")}
          placeholderTextColor={colors.muted}
          value={form.title}
          onChangeText={(v) => setForm({ ...form, title: v })}
        />
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          placeholder={t("marketing.message")}
          placeholderTextColor={colors.muted}
          multiline
          value={form.message}
          onChangeText={(v) => setForm({ ...form, message: v })}
        />
        <TextInput
          style={styles.input}
          placeholder={t("marketing.audience")}
          placeholderTextColor={colors.muted}
          value={form.audience}
          onChangeText={(v) => setForm({ ...form, audience: v })}
        />
        {form.audience === "min_points" ? (
          <TextInput
            style={styles.input}
            placeholder={t("marketing.minPoints")}
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={form.min_points}
            onChangeText={(v) => setForm({ ...form, min_points: v })}
          />
        ) : null}
        <Pressable style={styles.primaryBtn} disabled={busy} onPress={() => void create()}>
          <Text style={styles.primaryBtnText}>{t("marketing.saveDraft")}</Text>
        </Pressable>
      </View>

      {campaigns.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.cardTitle}>{c.name}</Text>
          <Text style={styles.cardBody}>
            {c.status} · {c.audience} · {c.recipient_count ?? 0} recipients
          </Text>
          <Text style={styles.cardBody}>{c.title}</Text>
          <View style={styles.row}>
            {c.status === "Draft" ? (
              <Pressable style={styles.chip} onPress={() => send(c)}>
                <Text style={styles.chipText}>{t("marketing.send")}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.chip}
              onPress={() =>
                void api<{ data: Campaign }>(`/crm/campaigns/${c.id}`).then((r) => setDetail(r.data))
              }
            >
              <Text style={styles.chipText}>{t("marketing.detail")}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {detail ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{detail.name}</Text>
          {detail.delivery ? (
            <Text style={styles.cardBody}>
              Notified {detail.delivery.notified} · Email {detail.delivery.email_only} · Skipped{" "}
              {detail.delivery.skipped}
            </Text>
          ) : null}
          <Text style={styles.cardBody}>{detail.message}</Text>
          {(detail.recipients || []).map((r) => (
            <Text key={r.id} style={styles.cardBody}>
              {r.customer_name || r.id.slice(0, 8)} · {r.channel_status}
            </Text>
          ))}
          <Pressable onPress={() => setDetail(null)}>
            <Text style={styles.link}>{t("common.close")}</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable style={styles.primaryBtn} onPress={() => router.push("/app/customers")}>
        <Text style={styles.primaryBtnText}>{t("nav.customers")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading, marginBottom: 12 },
  error: { color: colors.danger, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    color: colors.heading,
    backgroundColor: colors.bgSecondary,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: colors.white, fontWeight: "700" },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontWeight: "700", color: colors.heading, marginBottom: 4 },
  cardBody: { color: colors.body, fontSize: 13, marginBottom: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.heading, fontSize: 12, fontWeight: "600" },
  link: { color: colors.brand, marginTop: 8, fontWeight: "600" },
});
