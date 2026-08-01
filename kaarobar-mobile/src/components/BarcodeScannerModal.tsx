import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";

/**
 * Barcode entry modal (RN CLI). Camera scanning can be re-enabled with
 * Manual barcode entry for POS (native camera / ML Kit can replace this later).
 */
export function BarcodeScannerModal({
  visible,
  onClose,
  onScan,
  title = "Scan barcode",
}: {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}) {
  const palette = useBrandPalette();
  const [code, setCode] = useState("");

  useEffect(() => {
    if (visible) setCode("");
  }, [visible]);

  function submit() {
    const trimmed = code.trim();
    if (!trimmed) return;
    onScan(trimmed);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose}>
            <Text style={[styles.close, { color: palette.brand }]}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.body}>
            Enter the product barcode. Camera scan can be enabled when device
            camera permissions are configured for this build.
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoFocus
            placeholder="Barcode / SKU"
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.btn, { backgroundColor: palette.brand }]}
            onPress={submit}
          >
            <Text style={styles.btnText}>Use code</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bgPrimary, paddingTop: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.heading },
  close: { fontWeight: "700" },
  center: { padding: 24, gap: 12 },
  body: { color: colors.body, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.heading,
  },
  btn: {
    borderRadius: colors.radiusLg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: colors.white, fontWeight: "700" },
});
