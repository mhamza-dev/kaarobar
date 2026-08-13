import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { type Theme, useTheme } from "@/theme";
import { t } from "@/lib/i18n";
import {
  emptyListingFilters,
  type ListingFilterState,
} from "@/lib/listingFilters";

export type FilterOption = { value: string; label: string };

export type ListToolbarConfig = {
  categoryLabel?: string;
  categoryOptions?: FilterOption[];
  statusOptions?: FilterOption[];
  showPriceRange?: boolean;
  showDateRange?: boolean;
};

type Props = {
  value: ListingFilterState & {
    status?: string[];
    from?: string;
    to?: string;
  };
  onChange: (next: Props["value"]) => void;
  config?: ListToolbarConfig;
  searchPlaceholder?: string;
  /** When true, toolbar sits inside a list card (no outer padding). */
  embedded?: boolean;
};

export function emptyStaffFilters(): Props["value"] {
  return { ...emptyListingFilters(), status: [], from: "", to: "" };
}

/** Search row + Filters sheet for staff list screens. */
export default function ListToolbar({
  value,
  onChange,
  config,
  searchPlaceholder,
  embedded = false,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const placeholder = searchPlaceholder ?? t("common.search");

  const activeCount =
    (value.categories?.length || 0) +
    (value.status?.length || 0) +
    (value.priceMin ? 1 : 0) +
    (value.priceMax ? 1 : 0) +
    (value.from ? 1 : 0) +
    (value.to ? 1 : 0);

  function openDrawer() {
    setDraft(value);
    setOpen(true);
  }

  function toggleMulti(
    key: "categories" | "status",
    option: string,
    list: string[] | undefined
  ) {
    const cur = list || [];
    const next = cur.includes(option)
      ? cur.filter((x) => x !== option)
      : [...cur, option];
    setDraft({ ...draft, [key]: next });
  }

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <TextInput
        value={value.search}
        onChangeText={(search) => onChange({ ...value, search })}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        style={[styles.search, embedded && styles.searchEmbedded]}
      />
      <Pressable style={styles.filterBtn} onPress={openDrawer}>
        <Text style={styles.filterText}>
          {t("listFilters.filters")}
          {activeCount > 0 ? ` (${activeCount})` : ""}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("listFilters.title")}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.close}>{t("common.close")}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {config?.showDateRange ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t("common.from")} (YYYY-MM-DD)</Text>
                <TextInput
                  value={draft.from || ""}
                  onChangeText={(from) => setDraft({ ...draft, from })}
                  placeholder="2026-01-01"
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>{t("common.to")} (YYYY-MM-DD)</Text>
                <TextInput
                  value={draft.to || ""}
                  onChangeText={(to) => setDraft({ ...draft, to })}
                  placeholder="2026-12-31"
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
              </View>
            ) : null}

            {config?.categoryOptions?.length ? (
              <View style={styles.field}>
                <Text style={styles.label}>
                  {config.categoryLabel || t("listFilters.categories")}
                </Text>
                <View style={styles.chips}>
                  {config.categoryOptions.map((opt) => {
                    const on = (draft.categories || []).includes(opt.value);
                    return (
                      <Pressable
                        key={opt.value}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() =>
                          toggleMulti("categories", opt.value, draft.categories)
                        }
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {config?.statusOptions?.length ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t("common.status")}</Text>
                <View style={styles.chips}>
                  {config.statusOptions.map((opt) => {
                    const on = (draft.status || []).includes(opt.value);
                    return (
                      <Pressable
                        key={opt.value}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() =>
                          toggleMulti("status", opt.value, draft.status)
                        }
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {config?.showPriceRange ? (
              <View style={styles.field}>
                <Text style={styles.label}>Min price</Text>
                <TextInput
                  value={draft.priceMin}
                  onChangeText={(priceMin) => setDraft({ ...draft, priceMin })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>Max price</Text>
                <TextInput
                  value={draft.priceMax}
                  onChangeText={(priceMax) => setDraft({ ...draft, priceMax })}
                  keyboardType="decimal-pad"
                  placeholder="999999"
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                const cleared = emptyStaffFilters();
                setDraft(cleared);
                onChange(cleared);
                setOpen(false);
              }}
            >
              <Text style={styles.secondaryText}>{t("listFilters.clear")}</Text>
            </Pressable>
            <Pressable
              style={styles.primary}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              <Text style={styles.primaryText}>{t("listFilters.apply")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: "center",
    },
    wrapEmbedded: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 12,
      marginBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    search: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      borderRadius: t.radiusLg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.heading,
    },
    searchEmbedded: {
      backgroundColor: t.bgSecondary,
    },
    filterBtn: {
      borderWidth: 1,
      borderColor: t.brand,
      borderRadius: t.radiusLg,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    filterText: { color: t.brand, fontWeight: "700", fontSize: 13 },
    sheet: { flex: 1, backgroundColor: t.bgPrimary, paddingTop: 48 },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    sheetTitle: { fontSize: 20, fontWeight: "800", color: t.heading },
    close: { color: t.brand, fontWeight: "700" },
    sheetBody: { padding: 16, gap: 16 },
    field: { gap: 8, marginBottom: 12 },
    label: { fontSize: 13, fontWeight: "600", color: t.heading },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      borderRadius: t.radiusLg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.heading,
      marginBottom: 8,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: t.card,
    },
    chipOn: { backgroundColor: t.brand, borderColor: t.brand },
    chipText: { color: t.heading, fontWeight: "600", fontSize: 13 },
    chipTextOn: { color: t.white },
    sheetFooter: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    secondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radiusLg,
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryText: { fontWeight: "700", color: t.heading },
    primary: {
      flex: 1,
      backgroundColor: t.brand,
      borderRadius: t.radiusLg,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryText: { fontWeight: "700", color: t.white },
  });
}
