import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { GlassCard } from '@shared/ui/glass-card';
import { PressableScale } from '@shared/ui/pressable-scale';
import { StateView } from '@shared/ui/state-view';
import { makeStyles, useTheme } from '@/theme';

/**
 * Retail-relevant symbologies. QR is included because Kaarobar's own store
 * barcodes (`KB<initials><digits>`, see lib/barcode) are alphanumeric Code128,
 * and some shops print them as QR instead.
 */
const BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'qr',
];

/** Ignore repeat frames of the same code for this long. */
const RESCAN_COOLDOWN_MS = 1500;

export function BarcodeScannerModal({
  visible,
  onClose,
  onScan,
  title = 'Scan barcode',
}: {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [manualMode, setManualMode] = useState(false);

  // The camera fires onBarcodeScanned every frame it sees a code; without this
  // guard a single scan enqueues dozens of lookups.
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  // Reset per-open state during render rather than in an effect.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setManual('');
      setManualMode(false);
    }
  }

  // The cooldown ref is cleared in an effect, not above: reading or writing
  // `.current` during render is not allowed. Without this, reopening the modal
  // within the cooldown would silently ignore a rescan of the same product.
  useEffect(() => {
    if (visible) lastScan.current = null;
  }, [visible]);

  const handleScanned = useCallback(
    ({ data }: { data: string }) => {
      const code = data?.trim();
      if (!code) return;

      const now = Date.now();
      const prev = lastScan.current;
      if (prev && prev.code === code && now - prev.at < RESCAN_COOLDOWN_MS) return;
      lastScan.current = { code, at: now };

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
      }
      onScan(code);
      onClose();
    },
    [onScan, onClose],
  );

  function submitManual() {
    const code = manual.trim();
    if (!code) return;
    onScan(code);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.close, { color: theme.brandOn }]}>Close</Text>
          </Pressable>
        </View>

        {manualMode ? (
          <ManualEntry value={manual} onChange={setManual} onSubmit={submitManual} />
        ) : !permission ? (
          <View style={styles.center} />
        ) : !permission.granted ? (
          <StateView
            icon="camera-outline"
            title="Camera access needed"
            detail={
              permission.canAskAgain
                ? 'Allow camera access to scan product barcodes at the till.'
                : 'Camera access is blocked. Enable it for Kaarobar in your device settings, or type the code instead.'
            }
            actionLabel={permission.canAskAgain ? 'Allow camera' : undefined}
            onAction={permission.canAskAgain ? () => void requestPermission() : undefined}
            secondaryLabel="Enter code manually"
            onSecondary={() => setManualMode(true)}
          />
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={handleScanned}
            />
            <View style={styles.reticle} pointerEvents="none">
              <View style={[styles.reticleBox, { borderColor: theme.brandOn }]} />
            </View>
            <View style={styles.hintBar}>
              <Ionicons name="scan-outline" size={16} color={theme.inverse} />
              <Text style={styles.hintText}>Point at the product barcode</Text>
            </View>
            <PressableScale
              onPress={() => setManualMode(true)}
              style={[styles.manualBtn, { backgroundColor: theme.glassStrong }]}
              accessibilityRole="button">
              <Text style={[styles.manualBtnText, { color: theme.heading }]}>
                Enter code manually
              </Text>
            </PressableScale>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ManualEntry({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onUseCamera?: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <GlassCard title="Enter barcode" subtitle="Type or paste the code printed on the label">
        <TextInput
          value={value}
          onChangeText={onChange}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Barcode / SKU"
          placeholderTextColor={theme.muted}
          style={styles.input}
          onSubmitEditing={onSubmit}
          returnKeyType="done"
        />
        <PressableScale
          haptic
          onPress={onSubmit}
          style={[styles.submit, { backgroundColor: theme.brand }]}
          accessibilityRole="button">
          <Text style={[styles.submitText, { color: theme.brandForeground }]}>Use code</Text>
        </PressableScale>
      </GlassCard>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { flex: 1, backgroundColor: t.bgPrimary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing['2xl'],
    paddingBottom: t.spacing.md,
  },
  title: { fontSize: 18, fontWeight: '800', color: t.heading },
  close: { fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', padding: t.spacing.lg },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  reticle: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: '76%',
    aspectRatio: 1.5,
    borderWidth: 3,
    borderRadius: t.radius.xl,
  },
  hintBar: {
    position: 'absolute',
    top: t.spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radius.pill,
  },
  hintText: { color: '#ffffff', fontWeight: '600', fontSize: 12 },
  manualBtn: {
    position: 'absolute',
    bottom: t.spacing.xl,
    alignSelf: 'center',
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.md,
    borderRadius: t.radius.pill,
  },
  manualBtnText: { fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.bgSecondary,
    borderRadius: t.radius.lg,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    color: t.heading,
    fontSize: 16,
  },
  submit: {
    borderRadius: t.radius.lg,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
    marginTop: t.spacing.md,
  },
  submitText: { fontWeight: '700', fontSize: 15 },
}));
