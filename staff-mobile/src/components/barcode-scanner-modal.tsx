import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { makeStyles, useBrandPalette, useTheme } from "@/theme";

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
  const styles = useStyles();
  const theme = useTheme();
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
            placeholderTextColor={theme.muted}
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

const useStyles = makeStyles((t) => ({
  wrap: { flex: 1, backgroundColor: t.bgPrimary, paddingTop: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "800", color: t.heading },
  close: { fontWeight: "700" },
  center: { padding: 24, gap: 12 },
  body: { color: t.body, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.card,
    borderRadius: t.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: t.heading,
  },
  btn: {
    borderRadius: t.radiusLg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: t.white, fontWeight: "700" },
}));
