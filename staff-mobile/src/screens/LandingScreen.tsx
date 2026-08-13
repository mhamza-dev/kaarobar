import { useMemo } from "react";
import { type Theme, useTheme } from "@/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KaarobarLogo from "@/components/kaarobar-logo";
import { pushPath } from "@/lib/nav";

export default function LandingScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>More than one shop? This is for you.</Text>
      <View style={styles.brandRow}>
        <KaarobarLogo size={56} />
        <Text style={styles.brand}>Kaarobar</Text>
      </View>
      <Text style={styles.subtitle}>
        Run the till, keep proper books, and manage staff across every business
        and branch you own.
      </Text>

      <View style={styles.pills}>
        {["Branch POS", "Real books", "HR & payroll", "FBR ready"].map((label) => (
          <View key={label} style={styles.pill}>
            <Text style={styles.pillText}>{label}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primary} onPress={() => pushPath("/login")}>
        <Text style={styles.primaryText}>Sign in</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => pushPath("/signup")}>
        <Text style={styles.secondaryText}>Create owner account</Text>
      </Pressable>
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    backgroundColor: t.bgPrimary,
  },
  eyebrow: {
    color: t.brand,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  brand: {
    fontSize: 40,
    fontWeight: "800",
    color: t.heading,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: t.body,
    marginBottom: 24,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  pill: {
    backgroundColor: t.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { color: t.brand, fontWeight: "600", fontSize: 12 },
  primary: {
    backgroundColor: t.brand,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryText: {
    color: t.white,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  secondary: {
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.card,
    paddingVertical: 14,
    borderRadius: 12,
  },
  secondaryText: {
    color: t.heading,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
});
}
