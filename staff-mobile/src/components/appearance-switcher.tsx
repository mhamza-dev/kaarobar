import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { makeStyles, useTheme, useThemeControls, type SchemePreference } from '@/theme';

type Option = {
  value: SchemePreference;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const OPTIONS: Option[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** Light / dark / follow-system picker for Settings. */
export function AppearanceSwitcher() {
  const styles = useStyles();
  const theme = useTheme();
  const { preference, setPreference } = useThemeControls();

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => setPreference(opt.value)}
            haptic
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              styles.option,
              active && {
                backgroundColor: theme.brandAlpha(theme.isDark ? 0.24 : 0.12),
                borderColor: theme.brandOn,
              },
            ]}>
            <Ionicons
              name={opt.icon}
              size={18}
              color={active ? theme.brandOn : theme.muted}
            />
            <Text style={[styles.label, { color: active ? theme.brandOn : theme.body }]}>
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.md,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.cardMuted,
  },
  label: {
    fontSize: t.typography.caption.fontSize,
    fontWeight: '700',
  },
}));
