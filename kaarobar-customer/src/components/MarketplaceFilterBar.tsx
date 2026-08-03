import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../lib/api";
import { t } from "../lib/i18n";
import { countMarketplaceAdvancedFilters } from "../lib/marketplaceFeed";
import type { MarketplaceFeedFilters } from "../lib/marketplaceFeed";
import { useBrandPalette } from "../lib/BrandThemeContext";

type Props = {
  value: MarketplaceFeedFilters;
  onChange: (next: MarketplaceFeedFilters) => void;
  industryOptions: string[];
  categoryOptions?: string[];
  searchPlaceholder?: string;
  /** When false, only industry filters are shown (shops browse). Default true. */
  showCategories?: boolean;
  showPriceRange?: boolean;
};

function toggleValue(list: string[], opt: string): string[] {
  return list.includes(opt) ? list.filter((x) => x !== opt) : [...list, opt];
}

/** Search + Filters button with draft Apply/Cancel bottom sheet (multi-select). */
export default function MarketplaceFilterBar({
  value,
  onChange,
  industryOptions,
  categoryOptions = [],
  searchPlaceholder,
  showCategories = true,
  showPriceRange = true,
}: Props) {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MarketplaceFeedFilters>(value);

  const badge = countMarketplaceAdvancedFilters({
    ...value,
    categories: showCategories ? value.categories : [],
    priceMin: showPriceRange ? value.priceMin : "",
    priceMax: showPriceRange ? value.priceMax : "",
  });
  const summary = useMemo(() => {
    const items: { kind: "industry" | "category" | "price"; label: string }[] = [];
    for (const ind of value.industries) {
      items.push({ kind: "industry", label: ind });
    }
    if (showCategories) {
      for (const cat of value.categories) {
        items.push({ kind: "category", label: cat });
      }
    }
    if (showPriceRange && (value.priceMin.trim() || value.priceMax.trim())) {
      items.push({
        kind: "price",
        label: `${t("marketplace.priceRange")}: ${value.priceMin || "…"}–${value.priceMax || "…"}`,
      });
    }
    return items;
  }, [value, showCategories, showPriceRange]);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const openSheet = () => {
    setDraft(value);
    setOpen(true);
  };

  const cancel = () => {
    setOpen(false);
  };

  const apply = () => {
    onChange({
      ...value,
      industries: draft.industries,
      categories: showCategories ? draft.categories : value.categories,
      priceMin: showPriceRange ? draft.priceMin : value.priceMin,
      priceMax: showPriceRange ? draft.priceMax : value.priceMax,
    });
    setOpen(false);
  };

  const clearAdvanced = () => {
    setDraft((d) => ({
      ...d,
      industries: [],
      categories: showCategories ? [] : d.categories,
      priceMin: showPriceRange ? "" : d.priceMin,
      priceMax: showPriceRange ? "" : d.priceMax,
    }));
  };

  const removeSummary = (
    kind: "industry" | "category" | "price",
    label: string
  ) => {
    if (kind === "industry") {
      onChange({
        ...value,
        industries: value.industries.filter((x) => x !== label),
      });
    } else if (kind === "category") {
      onChange({
        ...value,
        categories: value.categories.filter((x) => x !== label),
      });
    } else {
      onChange({ ...value, priceMin: "", priceMax: "" });
    }
  };

  const clearAllAdvanced = () => {
    onChange({
      ...value,
      industries: [],
      categories: showCategories ? [] : value.categories,
      priceMin: showPriceRange ? "" : value.priceMin,
      priceMax: showPriceRange ? "" : value.priceMax,
    });
  };

  const hasSheetOptions = true;

  const draftCount = countMarketplaceAdvancedFilters({
    ...draft,
    categories: showCategories ? draft.categories : [],
    priceMin: showPriceRange ? draft.priceMin : "",
    priceMax: showPriceRange ? draft.priceMax : "",
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <TextInput
          value={value.search}
          onChangeText={(search) => onChange({ ...value, search })}
          placeholder={
            searchPlaceholder || t("marketplace.searchAllProducts")
          }
          placeholderTextColor={colors.muted}
          style={styles.search}
        />
        {hasSheetOptions ? (
          <Pressable
            onPress={openSheet}
            style={[styles.filtersBtn, badge > 0 && styles.filtersBtnOn]}
            accessibilityRole="button"
            accessibilityLabel={
              badge > 0
                ? t("marketplace.filtersActive", { count: badge })
                : t("marketplace.filters")
            }
          >
            <Text
              style={[
                styles.filtersBtnText,
                badge > 0 && styles.filtersBtnTextOn,
              ]}
            >
              {t("marketplace.filters")}
            </Text>
            {badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {summary.length > 0 ? (
        <View style={styles.summaryRow}>
          {summary.map((item) => (
            <Pressable
              key={`${item.kind}:${item.label}`}
              onPress={() => removeSummary(item.kind, item.label)}
              style={styles.summaryChip}
            >
              <Text style={styles.summaryChipText}>{item.label}</Text>
              <Text style={styles.summaryChipX}>×</Text>
            </Pressable>
          ))}
          <Pressable onPress={clearAllAdvanced} hitSlop={8}>
            <Text style={[styles.clearLink, { color: palette.brand }]}>
              {t("marketplace.clearFilters")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={cancel}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropTap} onPress={cancel} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>
                  {t("marketplace.filtersTitle")}
                </Text>
                <Text style={styles.sheetDesc}>
                  {t("marketplace.filtersDesc")}
                </Text>
              </View>
              <Pressable onPress={cancel} hitSlop={12}>
                <Text style={{ color: palette.brand, fontWeight: "700" }}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {showPriceRange ? (
                <View style={styles.group}>
                  <Text style={styles.groupLabel}>{t("marketplace.priceRange")}</Text>
                  <View style={styles.priceRow}>
                    <TextInput
                      value={draft.priceMin}
                      onChangeText={(priceMin) =>
                        setDraft((d) => ({ ...d, priceMin }))
                      }
                      placeholder={t("listFilters.min")}
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      style={styles.priceInput}
                    />
                    <TextInput
                      value={draft.priceMax}
                      onChangeText={(priceMax) =>
                        setDraft((d) => ({ ...d, priceMax }))
                      }
                      placeholder={t("listFilters.max")}
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      style={styles.priceInput}
                    />
                  </View>
                </View>
              ) : null}
              {industryOptions.length > 0 ? (
                <MultiChipGroup
                  label={t("marketplace.filterIndustry")}
                  options={industryOptions}
                  selected={draft.industries}
                  onToggle={(opt) =>
                    setDraft((d) => ({
                      ...d,
                      industries: toggleValue(d.industries, opt),
                    }))
                  }
                  styles={styles}
                />
              ) : null}
              {showCategories && categoryOptions.length > 0 ? (
                <MultiChipGroup
                  label={t("marketplace.filterCategory")}
                  options={categoryOptions}
                  selected={draft.categories}
                  onToggle={(opt) =>
                    setDraft((d) => ({
                      ...d,
                      categories: toggleValue(d.categories, opt),
                    }))
                  }
                  styles={styles}
                />
              ) : null}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable
                onPress={clearAdvanced}
                disabled={draftCount === 0}
                style={styles.footerSecondary}
              >
                <Text
                  style={[
                    styles.footerSecondaryText,
                    { color: palette.brand },
                    draftCount === 0 && styles.footerDisabled,
                  ]}
                >
                  {t("marketplace.clearFilters")}
                </Text>
              </Pressable>
              <View style={styles.footerActions}>
                <Pressable onPress={cancel} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  onPress={apply}
                  style={[styles.applyBtn, { backgroundColor: palette.brand }]}
                >
                  <Text style={styles.applyBtnText}>
                    {t("marketplace.applyFilters")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MultiChipGroup({
  label,
  options,
  selected,
  onToggle,
  styles,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (opt: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.chipBlock}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => onToggle(opt)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(palette: { brand: string; brandSoft: string }) {
  return StyleSheet.create({
    wrap: { gap: 10 },
    searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    search: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.heading,
      backgroundColor: colors.bgPrimary,
    },
    filtersBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.card,
    },
    filtersBtnOn: {
      backgroundColor: palette.brand,
      borderColor: palette.brand,
    },
    filtersBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.heading,
    },
    filtersBtnTextOn: { color: "#fff" },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#fff",
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "800",
      color: palette.brand,
    },
    summaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "center",
    },
    summaryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 5,
      backgroundColor: palette.brandSoft,
    },
    summaryChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.heading,
    },
    summaryChipX: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.muted,
      lineHeight: 16,
    },
    clearLink: { fontSize: 12, fontWeight: "700" },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(15,23,42,0.45)",
    },
    backdropTap: { flex: 1 },
    sheet: {
      maxHeight: "78%",
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 16,
      paddingBottom: 28,
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    sheetHeaderText: { flex: 1, gap: 4 },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.heading,
    },
    sheetDesc: { fontSize: 13, color: colors.body, lineHeight: 18 },
    sheetScroll: { flexGrow: 0 },
    sheetScrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      gap: 16,
    },
    chipBlock: { gap: 8 },
    group: { gap: 8 },
    groupLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.muted,
    },
    priceRow: { flexDirection: "row", gap: 8 },
    priceInput: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.heading,
      backgroundColor: colors.bgPrimary,
    },
    chipLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.muted,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.bgPrimary,
    },
    chipOn: {
      backgroundColor: palette.brand,
      borderColor: palette.brand,
    },
    chipText: { fontSize: 12, fontWeight: "700", color: colors.heading },
    chipTextOn: { color: "#fff" },
    sheetFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 10,
    },
    footerSecondary: { alignSelf: "flex-start" },
    footerSecondaryText: { fontSize: 13, fontWeight: "700" },
    footerDisabled: { opacity: 0.4 },
    footerActions: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "flex-end",
    },
    cancelBtn: {
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.bgPrimary,
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.heading,
    },
    applyBtn: {
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    applyBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
}
