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
import { api, colors, setSession } from "../lib/api";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
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
            email: email.trim(),
            password,
            name: name.trim(),
            business_name: businessName.trim(),
          }),
        },
        null
      );
      await setSession({ access_token: result.access_token, user: result.user });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.hint}>Owner account with first business + COA.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {[
        { label: "Full name", value: name, set: setName, secure: false },
        { label: "Business name", value: businessName, set: setBusinessName, secure: false },
        { label: "Email", value: email, set: setEmail, secure: false },
        { label: "Password", value: password, set: setPassword, secure: true },
      ].map((field) => (
        <View key={field.label}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            secureTextEntry={field.secure}
            autoCapitalize={field.secure || field.label === "Email" ? "none" : "words"}
            keyboardType={field.label === "Email" ? "email-address" : "default"}
            value={field.value}
            onChangeText={field.set}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
        </View>
      ))}

      <Pressable style={styles.primary} onPress={onSubmit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>Create account</Text>
        )}
      </Pressable>
      <Link href="/login" style={styles.link}>
        Already have an account? Sign in
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
});
