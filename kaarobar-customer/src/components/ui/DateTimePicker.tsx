import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../../lib/api";
import { useBrandPalette } from "../../lib/BrandThemeContext";

export type DateTimePickerMode = "date" | "datetime";

type Props = {
  value: string;
  onChange: (next: string) => void;
  mode?: DateTimePickerMode;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * RN date/datetime field. Uses ISO-like strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`).
 * Opens a simple editor modal (keyboard) — calendar polish can match web later.
 */
export default function DateTimePicker({
  value,
  onChange,
  mode = "date",
  label,
  placeholder,
  disabled,
}: Props) {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette.brand), [palette.brand]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        disabled={disabled}
        style={[styles.trigger, disabled && styles.disabled]}
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
          {value ||
            placeholder ||
            (mode === "datetime" ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD")}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label || "Date"}</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={mode === "datetime" ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable
            style={styles.done}
            onPress={() => {
              onChange(draft.trim());
              setOpen(false);
            }}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(brand: string) {
  return StyleSheet.create({
    label: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    trigger: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.bgPrimary,
    },
    disabled: { opacity: 0.55 },
    value: { color: colors.heading, fontSize: 14 },
    placeholder: { color: colors.muted, fontSize: 14 },
    backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },
    sheet: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      padding: 16,
      paddingBottom: 28,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.heading,
      marginBottom: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.heading,
      marginBottom: 12,
    },
    done: {
      backgroundColor: brand,
      borderRadius: 6,
      paddingVertical: 12,
      alignItems: "center",
    },
    doneText: { color: "#fff", fontWeight: "700" },
  });
}
