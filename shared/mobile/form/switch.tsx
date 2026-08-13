import { useId, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type Theme, useTheme } from "@shared/theme";

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
};

export default function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const id = useId();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.row, disabled && styles.disabled]}
      accessibilityLabel={label}
      testID={id}
    >
      <View style={[styles.track, checked ? styles.trackOn : null]}>
        <View style={[styles.knob, checked ? styles.knobOn : null]} />
      </View>
      {(label || description) && (
        <View style={styles.textCol}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {description ? <Text style={styles.desc}>{description}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    disabled: { opacity: 0.55 },
    track: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.border,
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    trackOn: { backgroundColor: t.brand },
    knob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#fff",
      alignSelf: "flex-start",
    },
    knobOn: { alignSelf: "flex-end" },
    textCol: { flex: 1 },
    label: { fontSize: 14, fontWeight: "600", color: t.heading },
    desc: { marginTop: 2, fontSize: 12, color: t.muted },
  });
}
