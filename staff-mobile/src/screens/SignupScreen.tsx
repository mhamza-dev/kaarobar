import { useState, useMemo } from "react";
import { type Theme, useTheme } from "@/theme";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, hydrateSessionContext, setSession } from "@/lib/api";
import KaarobarLogo from "@/components/kaarobar-logo";
import { replacePath, pushPath } from "@/lib/nav";
import CustomForm from "@/components/form/custom-form";
import { FormikTextField, FormikSwitchField } from "@/components/form/form-fields";
import { signupSchema, type SignupFormValues } from "@/lib/validations/auth";

const signupInitial: SignupFormValues = {
  signupMethod: "email",
  fullName: "",
  businessName: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

export default function SignupScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: SignupFormValues) {
    setBusy(true);
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
            email: values.email?.trim(),
            password: values.password,
            name: values.fullName.trim(),
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
      replacePath("/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
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
        initialValues={signupInitial}
        validationSchema={signupSchema}
        onSubmit={onSubmit}
      >
        {({ handleSubmit }) => (
          <>
            <FormikTextField
              name="fullName"
              label="Full name"
              style={styles.input}
              autoCapitalize="words"
            />
            <FormikTextField
              name="businessName"
              label="Business name"
              style={styles.input}
              autoCapitalize="words"
            />
            <FormikTextField
              name="email"
              label="Email"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <FormikTextField
              name="password"
              label="Password"
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />
            <FormikTextField
              name="confirmPassword"
              label="Confirm password"
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />
            <FormikSwitchField
              name="acceptTerms"
              label="I accept the Terms & Conditions"
            />

            <Pressable style={styles.primary} onPress={() => handleSubmit()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <Text style={styles.primaryText}>Create account</Text>
              )}
            </Pressable>
          </>
        )}
      </CustomForm>

      <Pressable onPress={() => pushPath("/login")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
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
    brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
    brandTitle: { fontSize: 18, fontWeight: "800", color: t.heading },
    brandSub: { fontSize: 12, color: t.body, marginTop: 2 },
    title: { fontSize: 28, fontWeight: "800", color: t.heading },
    hint: { marginTop: 8, marginBottom: 20, color: t.body },
    error: {
      backgroundColor: "#fee2e2",
      color: t.danger,
      padding: 10,
      borderRadius: 8,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
      color: t.heading,
    },
    primary: {
      backgroundColor: t.brand,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryText: { color: t.white, fontWeight: "700", fontSize: 16 },
    link: { marginTop: 18, textAlign: "center", color: t.brand, fontWeight: "600" },
  });
}
