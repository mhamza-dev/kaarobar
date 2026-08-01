import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";

/** Shared marketplace page hero. */
export function BuyerHero({
  title,
  description,
  eyebrow,
  children,
  accent,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
  accent?: string | null;
}) {
  const palette = useBrandPalette();
  return (
    <View
      style={[
        styles.hero,
        accent
          ? { borderTopColor: accent, borderTopWidth: 4 }
          : { borderTopColor: palette.brand, borderTopWidth: 3 },
      ]}
    >
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      {description ? <Text style={styles.heroDesc}>{description}</Text> : null}
      {children}
    </View>
  );
}

/** Larger marketplace surface card. */
export function BuyerCard({
  children,
  style,
  accent,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string | null;
  onPress?: () => void;
}) {
  const inner = (
    <View
      style={[
        styles.card,
        accent ? { borderTopColor: accent, borderTopWidth: 3 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/** Consistent empty / no-results panel. */
export function BuyerEmptyPanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const palette = useBrandPalette();
  return (
    <View
      style={[
        styles.empty,
        { borderColor: `${palette.brand}55`, backgroundColor: palette.brandLight || palette.brandSoft },
      ]}
    >
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          style={[styles.emptyBtn, { backgroundColor: palette.brand }]}
          onPress={onAction}
        >
          <Text style={[styles.emptyBtnText, { color: palette.brandForeground }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function formatMarketplacePrice(price?: string | number | null): string {
  const n = Number(price || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function marketplaceProductCategory(p: {
  category?: string | null;
  category_ref?: { name?: string | null } | null;
}): string {
  return p.category_ref?.name || p.category || "Uncategorized";
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.heading,
    letterSpacing: -0.3,
  },
  heroDesc: { color: colors.body, marginTop: 6, lineHeight: 20, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  empty: {
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "800", color: colors.heading, fontSize: 17, textAlign: "center" },
  emptyBody: {
    color: colors.body,
    marginTop: 6,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 20,
  },
  emptyBtn: {
    borderRadius: colors.radiusLg,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyBtnText: { fontWeight: "700" },
});
