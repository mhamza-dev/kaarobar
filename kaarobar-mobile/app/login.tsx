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
import {
  api,
  colors,
  hydrateSessionContext,
  setSession,
  type AuthActor,
  type Session,
} from "../lib/api";
import { setLocale, t, type Locale } from "../lib/i18n";
import KaarobarLogo from "../components/KaarobarLogo";

export default function LoginScreen() {
  const [actor, setActor] = useState<AuthActor>("business");
  const [email, setEmail] = useState("owner@kaarobar.local");
  const [password, setPassword] = useState("Password@123");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleBuyer() {
    const next: AuthActor = actor === "consumer" ? "business" : "consumer";
    setActor(next);
    setEmail(next === "consumer" ? "ayesha.customer@kaarobar-demo.pk" : "owner@kaarobar.local");
    setError(null);
  }

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      if (actor === "consumer") {
        const result = await api<{
          access_token: string;
          account: NonNullable<Session["account"]>;
          memberships?: Session["buyer_memberships"];
        }>(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              actor: "consumer",
              email: email.trim(),
              password,
            }),
          },
          null
        );
        const base: Session = {
          actor: "consumer",
          access_token: result.access_token,
          account: result.account,
          buyer_memberships: result.memberships || [],
          user: {
            id: result.account.id,
            email: result.account.email,
            name: result.account.name || result.account.email,
            phone: result.account.phone,
          },
        };
        const hydrated = await hydrateSessionContext(base);
        await setSession(hydrated);
        router.replace("/app/dashboard");
        return;
      }

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
          body: JSON.stringify({
            actor: "business",
            email: email.trim(),
            password,
            remember_me: rememberMe,
          }),
        },
        null
      );
      const hydrated = await hydrateSessionContext({
        actor: "business",
        access_token: result.access_token,
        user: result.user,
      });
      await setSession(hydrated);
      if (result.user.locale === "ur" || result.user.locale === "en") {
        await setLocale(result.user.locale);
      }
      router.replace("/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <KaarobarLogo size={48} />
        <View>
          <Text style={styles.brandTitle}>{t("common.appName")}</Text>
          <Text style={styles.brandSub}>
            {actor === "consumer" ? "Consumer marketplace" : t("common.pointOfSale")}
          </Text>
        </View>
      </View>
      <Text style={styles.title}>
        {actor === "consumer" ? "Consumer sign in" : t("auth.signInTitle")}
      </Text>
      <Text style={styles.hint}>
        {actor === "consumer"
          ? "Order from Kaarobar stores with your buyer account."
          : t("auth.signInSub")}
      </Text>

      <Pressable style={styles.toggle} onPress={toggleBuyer}>
        <Text style={styles.toggleText}>
          {actor === "consumer" ? "Sign in as Business" : "Sign in as Consumer"}
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>{t("auth.email")}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholder={actor === "consumer" ? "you@email.com" : "you@company.com"}
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

      {actor === "business" ? (
        <Pressable
          style={styles.rememberRow}
          onPress={() => setRememberMe((v) => !v)}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
            {rememberMe ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.rememberLabel}>Remember me</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.primary} onPress={onSubmit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>{t("common.signIn")}</Text>
        )}
      </Pressable>

      {actor === "business" ? (
        <Link href="/signup" style={styles.link}>
          {t("auth.needAccount")}
        </Link>
      ) : null}
      <Link href="/landing" style={styles.linkMuted}>
        {t("common.back")}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary, justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  brandTitle: { fontSize: 20, fontWeight: "800", color: colors.heading },
  brandSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  title: { fontSize: 28, fontWeight: "800", color: colors.heading },
  hint: { marginTop: 8, marginBottom: 12, color: colors.body },
  toggle: {
    alignSelf: "flex-start",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleText: { color: colors.brand, fontWeight: "700", fontSize: 13 },
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
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkboxMark: { color: colors.white, fontSize: 14, fontWeight: "700" },
  rememberLabel: { color: colors.heading, fontWeight: "600" },
  link: { marginTop: 18, textAlign: "center", color: colors.brand, fontWeight: "600" },
  linkMuted: { marginTop: 10, textAlign: "center", color: colors.muted },
});
