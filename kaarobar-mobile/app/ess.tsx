import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, getSession } from "../lib/api";
import { useEffect } from "react";

export default function EssScreen() {
  useEffect(() => {
    getSession().then((s) => {
      if (!s) router.replace("/landing");
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>For staff</Text>
      <Text style={styles.hint}>Clock in, request leave, and check payslips.</Text>
      {[
        { title: "Clock In / Out", body: "Mark attendance from your phone." },
        { title: "Request Leave", body: "Send leave for your manager to approve." },
        { title: "Payslips", body: "See past payslips after payroll is done." },
      ].map((card) => (
        <Pressable key={card.title} style={styles.card}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.cardBody}>{card.body}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading, marginBottom: 8 },
  hint: { color: colors.body, marginBottom: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.heading },
  cardBody: { marginTop: 4, color: colors.body },
});
