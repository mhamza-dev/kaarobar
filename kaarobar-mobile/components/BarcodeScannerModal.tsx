import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors } from "../lib/api";

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
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (visible) setLocked(false);
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.body}>Camera permission is required to scan barcodes.</Text>
            <Pressable style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code128",
                "code39",
                "qr",
              ],
            }}
            onBarcodeScanned={
              locked
                ? undefined
                : ({ data }) => {
                    if (!data) return;
                    setLocked(true);
                    onScan(String(data));
                    onClose();
                  }
            }
          />
        )}
        <Text style={styles.hint}>Point at a product barcode to add it.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.sidebar || "#0b1220",
  },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  close: { color: "#93c5fd", fontWeight: "700" },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  body: { color: "#fff", textAlign: "center", marginBottom: 16 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  hint: {
    color: "#cbd5e1",
    textAlign: "center",
    padding: 16,
    backgroundColor: "#0b1220",
  },
});
