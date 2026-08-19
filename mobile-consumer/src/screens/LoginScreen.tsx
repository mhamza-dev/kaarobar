import { useState, useMemo, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  api,
  consumeSessionTimedOut,
  colors,
  hydrateSessionContext,
  setSession,
  type Session,
} from "../lib/api";
import { t } from "../lib/i18n";
import KaarobarLogo from "../components/KaarobarLogo";
import CustomForm from "../components/ui/CustomForm";
import { FormikTextField } from "../components/ui/FormFields";
import {
  consumerLoginSchema,
  type ConsumerLoginValues,
} from "../lib/validations/auth";

/** Consumer marketplace sign-in (`customer_accounts`). */
export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  // `consumeSessionTimedOut()` clears the flag as it reads it, so it must run
  // exactly once — lazy initial state does that without an effect.
  const [error, setError] = useState<string | null>(() =>
    consumeSessionTimedOut() ? "Session timeout. Please login again." : null
  );

  async function onSubmit(values: ConsumerLoginValues) {
    setError(null);
    try {
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
            email: values.email.trim(),
            password: values.password,
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
      replacePath(navigation, "/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.brandRow}>
          <KaarobarLogo size={48} />
          <View>
            <Text style={styles.brandTitle}>{t("common.appName")}</Text>
            <Text style={styles.brandSub}>Consumer marketplace</Text>
          </View>
        </View>
        <Text style={styles.title}>Consumer sign in</Text>
        <Text style={styles.hint}>
          Order from Kaarobar stores with your buyer account.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <CustomForm
          initialValues={{
            email: "ayesha.customer@kaarobar-demo.pk",
            password: "Password@123",
          }}
          validationSchema={consumerLoginSchema}
          onSubmit={onSubmit}
        >
          {({ handleSubmit, isSubmitting }) => (
            <View>
              <FormikTextField
                name="email"
                label={t("auth.email")}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@email.com"
                style={{ marginBottom: 10 }}
              />
              <FormikTextField
                name="password"
                label={t("auth.password")}
                secureTextEntry
                placeholder="••••••••"
                style={{ marginBottom: 10 }}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.primary,
                  pressed && styles.primaryPressed,
                ]}
                onPress={() => handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryText}>{t("common.signIn")}</Text>
                )}
              </Pressable>
            </View>
          )}
        </CustomForm>

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
    primary: {
      backgroundColor: palette.brand,
      borderRadius: colors.radiusLg,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
    primaryText: { color: colors.white, fontWeight: "700", fontSize: 16 },
    linkMuted: { marginTop: 16, textAlign: "center", color: colors.muted },
  });
}
