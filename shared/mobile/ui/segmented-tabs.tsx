import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { makeStyles, useTheme } from "@shared/theme";

export type MobileTabItem<T extends string = string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  tabs: MobileTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
};

/** Horizontal underline tablist for RN screens. */
export default function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: Props<T>) {
  const styles = useStyles();
  const brand = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={styles.tab}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            <View
              style={[
                styles.indicator,
                active && { backgroundColor: brand.brand },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  scroll: { marginBottom: 14, flexGrow: 0 },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
    paddingHorizontal: 2,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    position: "relative",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: t.body,
  },
  labelActive: {
    color: t.heading,
    fontWeight: "700",
  },
  indicator: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
}));
