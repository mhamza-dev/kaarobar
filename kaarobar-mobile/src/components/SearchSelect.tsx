import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";

export type SearchSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type SearchSelectProps = {
  options: SearchSelectOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  disabled?: boolean;
};

export function SearchSelect({
  options,
  value,
  onChange,
  label,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyHint = "No matches",
  disabled = false,
}: SearchSelectProps) {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette.brand), [palette.brand]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.meta && o.meta.toLowerCase().includes(q))
    );
  }, [options, query]);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        <Text style={selected ? styles.triggerText : styles.placeholder} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label || placeholder}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            ListEmptyComponent={<Text style={styles.empty}>{emptyHint}</Text>}
            renderItem={({ item }) => {
              const on = item.value === value;
              return (
                <Pressable
                  style={[styles.row, on && styles.rowOn]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Text style={styles.rowText}>{item.label}</Text>
                  {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
                </Pressable>
              );
            }}
          />
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              onChange(null);
              setOpen(false);
              setQuery("");
            }}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

type SearchMultiSelectProps = {
  options: SearchSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  disabled?: boolean;
};

export function SearchMultiSelect({
  options,
  value,
  onChange,
  label,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyHint = "No matches",
  disabled = false,
}: SearchMultiSelectProps) {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette.brand), [palette.brand]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.meta && o.meta.toLowerCase().includes(q))
    );
  }, [options, query]);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        <Text style={value.length ? styles.triggerText : styles.placeholder} numberOfLines={1}>
          {value.length ? `${value.length} selected` : placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label || placeholder}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            ListEmptyComponent={<Text style={styles.empty}>{emptyHint}</Text>}
            renderItem={({ item }) => {
              const on = value.includes(item.value);
              return (
                <Pressable
                  style={[styles.row, on && styles.rowOn]}
                  onPress={() => toggle(item.value)}
                >
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.rowText}>{item.label}</Text>
                  {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
                </Pressable>
              );
            }}
          />
          <Pressable style={styles.doneBtn} onPress={() => setOpen(false)}>
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
    triggerText: { color: colors.heading, fontSize: 14 },
    placeholder: { color: colors.muted, fontSize: 14 },
    backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },
    sheet: {
      maxHeight: "70%",
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
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      color: colors.heading,
    },
    empty: { color: colors.muted, padding: 12, textAlign: "center" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
    rowOn: { backgroundColor: `${brand}18` },
    rowText: { flex: 1, color: colors.heading, fontSize: 14 },
    meta: { color: colors.muted, fontSize: 12 },
    check: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: brand, borderColor: brand },
    checkMark: { color: "#fff", fontSize: 11, fontWeight: "700" },
    clearBtn: { marginTop: 8, alignItems: "center", padding: 12 },
    clearText: { color: colors.muted, fontWeight: "600" },
    doneBtn: {
      marginTop: 8,
      backgroundColor: brand,
      borderRadius: 6,
      paddingVertical: 12,
      alignItems: "center",
    },
    doneText: { color: "#fff", fontWeight: "700" },
  });
}
