import { useState, useMemo } from "react";
import { replacePath, pushPath } from "@/lib/nav";
import { type Theme, useTheme } from "@/theme";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, consumeSessionTimedOut, hydrateSessionContext } from "@/lib/api";
import { useSession } from "@/lib/SessionContext";
import { t } from "@/lib/i18n";
import KaarobarLogo from "@/components/kaarobar-logo";
import CustomForm from "@/components/form/custom-form";
import { FormikTextField, FormikSwitchField } from "@/components/form/form-fields";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";

const loginInitial: LoginFormValues = {
  loginMethod: "email",
  email: "owner@kaarobar.local",
  phoneNumber: "",
  password: "Password@123",
  remember: false,
};

/** Business / staff sign-in only (CUS portal lives in kaarobar-customer). */
export default function LoginScreen() {
  const { setSession } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // `consumeSessionTimedOut()` clears the flag as it reads it, so it must run
  // exactly once — lazy initial state does that without an effect.
  const [error, setError] = useState<string | null>(() =>
    consumeSessionTimedOut() ? "Session timeout. Please login again." : null,
  );
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: LoginFormValues) {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{
        access_token: string;
        refresh_token?: string;
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
            email: values.email?.trim(),
            password: values.password,
            remember_me: values.remember,
          }),
        },
        null
      );
      const hydrated = await hydrateSessionContext({
        actor: "business",
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        user: result.user,
      });
      // Never log `hydrated` — it carries the access and refresh tokens.
      await setSession(hydrated);
      replacePath('/app/pos');
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

        <CustomForm
          initialValues={loginInitial}
          validationSchema={loginSchema}
          onSubmit={onSubmit}
        >
          {({ handleSubmit }) => (
            <>
              <FormikTextField
                name="email"
                label={t("auth.email")}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@company.com"
              />
              <FormikTextField
                name="password"
                label={t("auth.password")}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
              />
              <FormikSwitchField name="remember" label="Remember me" />

              <Pressable
                style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
                onPress={() => handleSubmit()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <Text style={styles.primaryText}>{t("common.signIn")}</Text>
                )}
              </Pressable>
            </>
          )}
        </CustomForm>

        <Pressable onPress={() => pushPath("/signup")}>
          <Text style={styles.link}>{t("auth.needAccount")}</Text>
        </Pressable>
        <Pressable onPress={() => pushPath("/landing")}>
          <Text style={styles.linkMuted}>{t("common.back")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      backgroundColor: t.bgPrimary,
      justifyContent: "center",
    },
    panel: {
      backgroundColor: t.glass,
      borderColor: t.glassBorder,
      borderWidth: 1,
      borderRadius: t.radiusLg,
      padding: 20,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 20,
    },
    brandTitle: { fontSize: 20, fontWeight: "800", color: t.heading },
    brandSub: { fontSize: 12, color: t.muted, marginTop: 2 },
    title: { fontSize: 28, fontWeight: "800", color: t.heading },
    hint: { marginTop: 8, marginBottom: 12, color: t.body },
    error: {
      backgroundColor: "#fee2e2",
      color: t.danger,
      padding: 10,
      borderRadius: t.radiusLg,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: t.glassBorder,
      backgroundColor: "rgba(255,255,255,0.9)",
      borderRadius: t.radiusLg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
      color: t.heading,
    },
    primary: {
      backgroundColor: t.brand,
      borderRadius: t.radiusLg,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
    primaryText: { color: t.white, fontWeight: "700", fontSize: 16 },
    link: {
      marginTop: 18,
      textAlign: "center",
      color: t.brand,
      fontWeight: "600",
    },
    linkMuted: { marginTop: 10, textAlign: "center", color: t.muted },
  });
}
