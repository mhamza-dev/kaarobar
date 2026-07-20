import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/api";

export function FormModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  onSubmit,
  submitLabel = "Save",
  busy,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  busy?: boolean;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
          <Pressable
            style={[styles.submit, busy && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={busy}
          >
            <Text style={styles.submitText}>{busy ? "Saving…" : submitLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", color: colors.heading },
  subtitle: { marginTop: 4, color: colors.body, fontSize: 13 },
  close: { color: colors.brand, fontWeight: "700" },
  body: { gap: 10 },
  submit: {
    marginTop: 16,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { color: colors.white, fontWeight: "700" },
});
