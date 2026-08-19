import { useEffect, useState } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "../lib/api";

function Bone({ style }: { style?: ViewStyle }) {
  // Lazy state rather than `useRef(...).current`: reading a ref during render
  // is not allowed, and this only needs to be created once.
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.bone, style, { opacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export function BuyerDiscoverSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.gap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Bone style={{ height: 88, borderRadius: 0 }} />
          <View style={{ padding: 14, gap: 8 }}>
            <Bone style={{ height: 16, width: "60%" }} />
            <Bone style={{ height: 12, width: "40%" }} />
            <Bone style={{ height: 12, width: "90%" }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function BuyerOrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.gap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, styles.row]}>
          <Bone style={{ height: 48, width: 48, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone style={{ height: 14, width: "45%" }} />
            <Bone style={{ height: 12, width: "65%" }} />
          </View>
          <Bone style={{ height: 16, width: 56 }} />
        </View>
      ))}
    </View>
  );
}

export function BuyerOrderDetailSkeleton() {
  return (
    <View style={[styles.card, { padding: 16, gap: 12 }]}>
      <Bone style={{ height: 22, width: "50%" }} />
      <Bone style={{ height: 14, width: "35%" }} />
      <Bone style={{ height: 1, width: "100%", marginVertical: 8 }} />
      <Bone style={{ height: 14, width: "100%" }} />
      <Bone style={{ height: 14, width: "100%" }} />
      <Bone style={{ height: 14, width: "80%" }} />
      <Bone style={{ height: 22, width: 100, alignSelf: "flex-end", marginTop: 8 }} />
    </View>
  );
}

export function BuyerProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, styles.gridCard]}>
          <Bone style={{ aspectRatio: 1, width: "100%", borderRadius: 0 }} />
          <View style={{ padding: 10, gap: 8 }}>
            <Bone style={{ height: 10, width: "40%" }} />
            <Bone style={{ height: 14, width: "85%" }} />
            <Bone style={{ height: 16, width: 64 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function BuyerLoyaltySkeleton() {
  return (
    <View style={styles.gap}>
      <Bone style={{ height: 88, borderRadius: 14 }} />
      <Bone style={{ height: 120, borderRadius: 14 }} />
      <Bone style={{ height: 120, borderRadius: 14 }} />
    </View>
  );
}

export function BuyerArSkeleton() {
  return (
    <View style={styles.gap}>
      <Bone style={{ height: 72, borderRadius: 14 }} />
      <Bone style={{ height: 72, borderRadius: 14 }} />
      <Bone style={{ height: 88, borderRadius: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: colors.border || "#E2E8F0",
    borderRadius: 8,
  },
  gap: { gap: 12 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  gridCard: {
    width: "48%",
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
});
