import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  LOCALES,
  LOCALE_NATIVE_LABELS,
  getLocale,
  setLocale,
  t,
  type Locale,
} from "@/lib/i18n";
import { makeStyles } from '@/theme';

type Props = {
  /** Bump parent re-render after locale change (module-level `t`). */
  onChange?: (locale: Locale) => void;
};

/** Chip row for selecting app locale (en, ur, de, pt-BR, es, fr, ar). */
export default function LanguageSwitcher({ onChange }: Props) {
  const styles = useStyles();
  const active = getLocale();

  return (
    <View>
      <Text style={styles.label}>{t("common.language")}</Text>
      <View style={styles.chips}>
        {LOCALES.map((code) => {
          const on = active === code;
          return (
            <Pressable
              key={code}
              style={[styles.chip, on && styles.chipOn]}
              onPress={async () => {
                await setLocale(code);
                onChange?.(code);
              }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {LOCALE_NATIVE_LABELS[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: t.heading,
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: t.card,
  },
  chipOn: { backgroundColor: t.brand, borderColor: t.brand },
  chipText: { fontWeight: "600", color: t.heading, fontSize: 13 },
  chipTextOn: { color: t.white },
}));
