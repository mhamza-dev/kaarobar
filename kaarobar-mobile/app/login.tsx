import { useState } from "react";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, hydrateSessionContext, setSession } from "../lib/api";
import { setLocale, t, type Locale } from "../lib/i18n";

export default function LoginScreen() {
  const [email, setEmail] = useState("owner@kaarobar.local");
  const [password, setPassword] = useState("Password@123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{
        access_token: string;
        user: {
          id: string;
          email: string;
          name: string;
          phone?: string | null;
          locale?: Locale;
        };
      }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        },
        null
      );
      const hydrated = await hydrateSessionContext({
        access_token: result.access_token,
        user: result.user,
      });
      await setSession(hydrated);
      if (result.user.locale === "ur" || result.user.locale === "en") {
        await setLocale(result.user.locale);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("auth.signInTitle")}</Text>
      <Text style={styles.hint}>{t("auth.signInSub")}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>{t("auth.email")}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholder="you@company.com"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>{t("auth.password")}</Text>
      <TextInput
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor={colors.muted}
      />

      <Pressable style={styles.primary} onPress={onSubmit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>{t("common.signIn")}</Text>
        )}
      </Pressable>

      <Link href="/signup" style={styles.link}>
        {t("auth.needAccount")}
      </Link>
      <Link href="/landing" style={styles.linkMuted}>
        {t("common.back")}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", color: colors.heading },
  hint: { marginTop: 8, marginBottom: 20, color: colors.body },
  error: {
    backgroundColor: "#fee2e2",
    color: colors.danger,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.heading, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    color: colors.heading,
  },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  link: { marginTop: 18, textAlign: "center", color: colors.brand, fontWeight: "600" },
  linkMuted: { marginTop: 10, textAlign: "center", color: colors.muted },
});
