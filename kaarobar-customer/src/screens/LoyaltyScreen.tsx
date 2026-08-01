import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import BuyerLoyalty from "../components/BuyerLoyalty";
import BuyerAr from "../components/BuyerAr";
import { colors } from "../lib/api";

export default function LoyaltyScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BuyerLoyalty />
      <BuyerAr />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { paddingBottom: 40 },
});
