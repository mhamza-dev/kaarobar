import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/api";
import {
  LOCALES,
  LOCALE_NATIVE_LABELS,
  getLocale,
  setLocale,
  t,
  type Locale,
} from "../lib/i18n";

type Props = {
  /** Bump parent re-render after locale change (module-level `t`). */
  onChange?: (locale: Locale) => void;
};

/** Chip row for selecting app locale (en, ur, de, pt-BR, es, fr, ar). */
export default function LanguageSwitcher({ onChange }: Props) {
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

const styles = StyleSheet.create({
  label: {
    fontWeight: "700",
    color: colors.heading,
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: "600", color: colors.heading, fontSize: 13 },
  chipTextOn: { color: colors.white },
});
