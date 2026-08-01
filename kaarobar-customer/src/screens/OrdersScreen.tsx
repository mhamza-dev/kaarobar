import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import BuyerOrders from "../components/BuyerOrders";
import { colors } from "../lib/api";
import { t } from "../lib/i18n";

/**
 * Orders + appointments tab.
 * Appointment list/booking is stubbed until SCH-FR appointments API lands.
 */
export default function OrdersScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BuyerOrders />
      <View style={styles.stub}>
        <Text style={styles.stubTitle}>{t("appointments.tabAppointments")}</Text>
        <Text style={styles.stubBody}>{t("appointments.emptyBody")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { paddingBottom: 40 },
  stub: {
    margin: 16,
    padding: 14,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  stubTitle: { fontWeight: "800", color: colors.heading, marginBottom: 6 },
  stubBody: { color: colors.body, fontSize: 13, lineHeight: 18 },
});
