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
      <Text style={styles.title}>Employee Self-Service</Text>
      <Text style={styles.hint}>Clock in/out, leave requests, and payslips.</Text>
      {[
        { title: "Clock In / Out", body: "Capture attendance from your phone." },
        { title: "Request Leave", body: "Submit leave for manager approval." },
        { title: "Payslips", body: "View history once payroll is posted." },
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
