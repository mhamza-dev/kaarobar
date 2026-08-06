import { useState, useMemo } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors, hydrateSessionContext, setSession } from "../lib/api";
import KaarobarLogo from "../components/KaarobarLogo";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import CustomForm from "../components/ui/CustomForm";
import { FormikTextField } from "../components/ui/FormFields";
import {
  ownerSignupSchema,
  type OwnerSignupValues,
} from "../lib/validations/auth";

export default function SignupScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: OwnerSignupValues) {
    setError(null);
    try {
      const result = await api<{
        access_token: string;
        user: { id: string; email: string; name: string };
      }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            actor: "business",
            email: values.email.trim(),
            password: values.password,
            name: values.name.trim(),
            business_name: values.businessName.trim(),
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
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <KaarobarLogo size={48} />
        <View>
          <Text style={styles.brandTitle}>Kaarobar</Text>
          <Text style={styles.brandSub}>Create your owner account</Text>
        </View>
      </View>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.hint}>Create your owner account and first business.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <CustomForm
        initialValues={{
          name: "",
          businessName: "",
          email: "",
          password: "",
        }}
        validationSchema={ownerSignupSchema}
        onSubmit={onSubmit}
      >
        {({ handleSubmit, isSubmitting }) => (
          <View>
            <FormikTextField
              name="name"
              label="Full name"
              autoCapitalize="words"
              style={{ marginBottom: 10 }}
            />
            <FormikTextField
              name="businessName"
              label="Business name"
              autoCapitalize="words"
              style={{ marginBottom: 10 }}
            />
            <FormikTextField
              name="email"
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ marginBottom: 10 }}
            />
            <FormikTextField
              name="password"
              label="Password"
              secureTextEntry
              autoCapitalize="none"
              style={{ marginBottom: 10 }}
            />
            <Pressable
              style={styles.primary}
              onPress={() => handleSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryText}>Create account</Text>
              )}
            </Pressable>
          </View>
        )}
      </CustomForm>
      <Pressable onPress={() => pushPath(navigation, "/login")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
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
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 24,
    },
    brandTitle: { fontSize: 18, fontWeight: "800", color: colors.heading },
    brandSub: { fontSize: 12, color: colors.body, marginTop: 2 },
    title: { fontSize: 28, fontWeight: "800", color: colors.heading },
    hint: { marginTop: 8, marginBottom: 20, color: colors.body },
    error: {
      backgroundColor: "#fee2e2",
      color: colors.danger,
      padding: 10,
      borderRadius: 8,
      marginBottom: 12,
    },
    primary: {
      backgroundColor: palette.brand,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryText: { color: colors.white, fontWeight: "700", fontSize: 16 },
    link: {
      marginTop: 18,
      textAlign: "center",
      color: palette.brand,
      fontWeight: "600",
    },
  });
}
