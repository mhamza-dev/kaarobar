import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

/**
 * Ambient brand-tinted mesh painted behind every screen. Three soft blobs on a
 * flat base — static (no animation loop) so it costs one paint and never
 * competes with list scrolling for frame budget.
 */
export function GradientMesh() {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bgPrimary }]} />

      <LinearGradient
        colors={[theme.mesh1, 'transparent']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.blob, styles.topLeft]}
      />
      <LinearGradient
        colors={[theme.mesh3, 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.blob, styles.topRight]}
      />
      <LinearGradient
        colors={['transparent', theme.mesh2]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.blob, styles.bottom]}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  topLeft: {
    top: -160,
    left: -120,
    width: 380,
    height: 380,
  },
  topRight: {
    top: -80,
    right: -140,
    width: 320,
    height: 320,
  },
  bottom: {
    bottom: -200,
    left: -60,
    right: -60,
    height: 420,
  },
}));
