import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/api";

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Multi-business · Multi-branch</Text>
      <Text style={styles.brand}>Kaarobar</Text>
      <Text style={styles.subtitle}>
        POS, double-entry accounting, and workforce tools for owners who run
        more than one business—and more than one branch.
      </Text>

      <View style={styles.pills}>
        {["Branch POS", "Real ledger", "HR & payroll", "FBR-ready"].map((label) => (
          <View key={label} style={styles.pill}>
            <Text style={styles.pillText}>{label}</Text>
          </View>
        ))}
      </View>

      <Link href="/login" asChild>
        <Pressable style={styles.primary}>
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </Link>
      <Link href="/signup" asChild>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Create owner account</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  eyebrow: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  brand: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.heading,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.body,
    marginBottom: 24,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  pill: {
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { color: colors.brand, fontWeight: "600", fontSize: 12 },
  primary: {
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryText: {
    color: colors.white,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 14,
    borderRadius: 12,
  },
  secondaryText: {
    color: colors.heading,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
});
