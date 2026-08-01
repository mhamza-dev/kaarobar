import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/api";

/** Customer alerts placeholder — portal notifications when wired. */
export default function AlertsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Alerts</Text>
      <Text style={styles.body}>
        Order updates and loyalty notices will show here. Push delivery uses the
        same device-token API as other Kaarobar clients when configured.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary, padding: 20 },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading },
  body: { marginTop: 10, color: colors.body, lineHeight: 20 },
});
