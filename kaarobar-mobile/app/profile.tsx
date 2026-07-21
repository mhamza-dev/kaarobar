import { useCallback, useEffect, useState } from "react";
import { router, Stack } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, getSession, setSession } from "../lib/api";
import { getLocale, loadLocale, setLocale, t, type Locale } from "../lib/i18n";
import { useToast } from "../components/Toast";

export default function ProfileScreen() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    locale: "en" as Locale,
    password: "",
  });

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      try {
        const res = await api<{
          user: {
            name: string;
            email: string;
            phone?: string | null;
            locale?: Locale;
          };
        }>("/auth/me");
        const locale = res.user.locale === "ur" ? "ur" : "en";
        setForm({
          name: res.user.name || "",
          email: res.user.email || "",
          phone: res.user.phone || "",
          locale,
          password: "",
        });
        await setLocale(locale);
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("profile.loadError"));
      }
    })();
  }, [refresh]);

  async function onSave() {
    setBusy(true);
    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        locale: form.locale,
      };
      if (form.password.trim()) body.password = form.password;

      const res = await api<{
        user: {
          id: string;
          name: string;
          email: string;
          phone?: string | null;
          locale?: Locale;
        };
      }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      const session = await getSession();
      if (session) {
        await setSession({
          ...session,
          user: {
            ...session.user,
            name: res.user.name,
            email: res.user.email,
            phone: res.user.phone,
            locale: res.user.locale === "ur" ? "ur" : "en",
          },
        });
      }
      await setLocale(res.user.locale === "ur" ? "ur" : "en");
      setForm((f) => ({ ...f, password: "" }));
      toast.success(t("profile.saved"));
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  // tick forces re-render after locale change
  void tick;
  const locale = getLocale();

  return (
    <>
      <Stack.Screen options={{ title: t("nav.profile") }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t("profile.eyebrow")}</Text>
        <Text style={styles.title}>{t("profile.title")}</Text>
        <Text style={styles.sub}>{t("profile.description")}</Text>

        <Text style={styles.label}>{t("profile.name")}</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(name) => setForm({ ...form, name })}
        />

        <Text style={styles.label}>{t("profile.email")}</Text>
        <TextInput style={[styles.input, styles.disabled]} value={form.email} editable={false} />

        <Text style={styles.label}>{t("profile.phone")}</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(phone) => setForm({ ...form, phone })}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>{t("profile.locale")}</Text>
        <View style={styles.row}>
          {(["en", "ur"] as Locale[]).map((code) => (
            <Pressable
              key={code}
              style={[styles.chip, form.locale === code && styles.chipOn]}
              onPress={() => setForm({ ...form, locale: code })}
            >
              <Text style={[styles.chipText, form.locale === code && styles.chipTextOn]}>
                {code === "ur" ? t("common.urdu") : t("common.english")}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{t("profile.localeHint")}</Text>

        <Text style={styles.label}>{t("profile.newPassword")}</Text>
        <TextInput
          style={styles.input}
          value={form.password}
          onChangeText={(password) => setForm({ ...form, password })}
          secureTextEntry
        />
        <Text style={styles.hint}>{t("profile.newPasswordHint")}</Text>

        <Pressable style={styles.btn} onPress={onSave} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>{t("profile.save")}</Text>
          )}
        </Pressable>

        <Text style={styles.meta}>
          {t("common.language")}: {locale === "ur" ? t("common.urdu") : t("common.english")}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: { marginTop: 6, fontSize: 24, fontWeight: "800", color: colors.heading },
  sub: { marginTop: 6, color: colors.body, marginBottom: 16 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: "600", color: colors.heading },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.heading,
  },
  disabled: { backgroundColor: colors.brandLight, color: colors.muted },
  hint: { marginTop: 4, fontSize: 12, color: colors.muted },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: "700", color: colors.heading },
  chipTextOn: { color: colors.white },
  btn: {
    marginTop: 20,
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.white, fontWeight: "700" },
  error: { color: colors.danger, marginBottom: 8 },
  ok: { color: colors.success, marginBottom: 8 },
  meta: { marginTop: 16, fontSize: 12, color: colors.muted },
});
