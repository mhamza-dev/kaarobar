import { useState, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import { useBrandPalette } from "../lib/BrandThemeContext";
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
} from "../lib/api";
import { t } from "../lib/i18n";
import KaarobarLogo from "../components/KaarobarLogo";

/** Business / staff sign-in only (CUS portal lives in kaarobar-customer). */
export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [email, setEmail] = useState("owner@kaarobar.local");
  const [password, setPassword] = useState("Password@123");
  const [rememberMe, setRememberMe] = useState(false);
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
      replacePath(navigation, "/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.brandRow}>
          <KaarobarLogo size={48} />
          <View>
            <Text style={styles.brandTitle}>{t("common.appName")}</Text>
            <Text style={styles.brandSub}>{t("common.pointOfSale")}</Text>
          </View>
        </View>
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

        <Pressable
          style={styles.rememberRow}
          onPress={() => setRememberMe((v) => !v)}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
            {rememberMe ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.rememberLabel}>Remember me</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>{t("common.signIn")}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => pushPath(navigation, "/signup")}>
          <Text style={styles.link}>{t("auth.needAccount")}</Text>
        </Pressable>
        <Pressable onPress={() => pushPath(navigation, "/landing")}>
          <Text style={styles.linkMuted}>{t("common.back")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      backgroundColor: colors.bgPrimary,
      justifyContent: "center",
    },
    panel: {
      backgroundColor: colors.glass,
      borderColor: colors.glassBorder,
      borderWidth: 1,
      borderRadius: colors.radiusLg,
      padding: 20,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 20,
    },
    brandTitle: { fontSize: 20, fontWeight: "800", color: colors.heading },
    brandSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    title: { fontSize: 28, fontWeight: "800", color: colors.heading },
    hint: { marginTop: 8, marginBottom: 12, color: colors.body },
    error: {
      backgroundColor: "#fee2e2",
      color: colors.danger,
      padding: 10,
      borderRadius: colors.radiusLg,
      marginBottom: 12,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.heading,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: "rgba(255,255,255,0.9)",
      borderRadius: colors.radiusLg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
      color: colors.heading,
    },
    primary: {
      backgroundColor: palette.brand,
      borderRadius: colors.radiusLg,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
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
      backgroundColor: palette.brand,
      borderColor: palette.brand,
    },
    checkboxMark: { color: colors.white, fontSize: 14, fontWeight: "700" },
    rememberLabel: { color: colors.heading, fontWeight: "600" },
    link: {
      marginTop: 18,
      textAlign: "center",
      color: palette.brand,
      fontWeight: "600",
    },
    linkMuted: { marginTop: 10, textAlign: "center", color: colors.muted },
  });
}
