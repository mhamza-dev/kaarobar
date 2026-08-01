import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import {
  api,
  clearSession,
  colors,
  getSession,
  isConsumerSession,
  type Session,
} from "../lib/api";
import { loadLocale, t } from "../lib/i18n";
import { useBrandPalette } from "../lib/BrandThemeContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { BuyerCard, BuyerHero } from "../components/BuyerLayout";
import BuyerNav from "../components/BuyerNav";

type NoteMeta = { unread?: number };

/** Buyer account hub — Balance, Loyalty, Alerts. */
export default function AccountScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [session, setLocal] = useState<Session | null>(null);
  const [localeTick, setLocaleTick] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (!s || !isConsumerSession(s)) {
        replacePath(navigation, "/landing");
        return;
      }
      setLocal(s);
    })();
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void api<{ data: unknown[]; meta?: NoteMeta }>("/portal/notifications")
        .then((res) => {
          setUnread(
            res.meta?.unread ??
              (res.data || []).filter(
                (n) => !(n as { read_at?: string | null }).read_at
              ).length
          );
        })
        .catch(() => setUnread(0));
    }, [])
  );

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const name = session.account?.name || session.user.name || t("marketplace.accountGuest");
  const contact = session.account?.email || session.user.email || session.user.phone || "";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const links = [
    {
      key: "balance",
      title: t("marketplace.accountBalance"),
      body: t("marketplace.accountBalanceBody"),
      onPress: () => pushPath(navigation, "/app/accounting"),
    },
    {
      key: "loyalty",
      title: t("marketplace.accountLoyalty"),
      body: t("marketplace.accountLoyaltyBody"),
      onPress: () => pushPath(navigation, "/app/customers"),
    },
    {
      key: "alerts",
      title: t("marketplace.accountAlerts"),
      body: t("marketplace.accountAlertsBody"),
      onPress: () => pushPath(navigation, "/app/notifications"),
      badge: unread,
    },
  ] as const;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      key={localeTick}
    >
      <BuyerNav />
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerAccountTitle")}
        description={t("pages.buyerAccountDesc")}
      />

      <BuyerCard style={styles.profile}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: palette.brand }]}>
            {session.user.profile_pic_url ? (
              <Image
                source={{ uri: session.user.profile_pic_url }}
                style={styles.avatarImg}
              />
            ) : (
              <Text style={[styles.avatarText, { color: palette.brandForeground }]}>
                {initials}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            {contact ? <Text style={styles.email}>{contact}</Text> : null}
          </View>
        </View>
      </BuyerCard>

      <View style={styles.linkGrid}>
        {links.map((item) => (
          <Pressable key={item.key} style={styles.linkCard} onPress={item.onPress}>
            <BuyerCard style={styles.linkInner}>
              <View style={styles.linkHead}>
                <View style={[styles.linkIcon, { backgroundColor: palette.brandSoft }]}>
                  <Text style={{ color: palette.brand, fontWeight: "800" }}>
                    {item.key === "balance" ? "Rs" : item.key === "loyalty" ? "★" : "🔔"}
                  </Text>
                </View>
                {"badge" in item && item.badge && item.badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.linkTitle}>{item.title}</Text>
              <Text style={styles.linkBody}>{item.body}</Text>
              <Text style={[styles.linkCta, { color: palette.brand }]}>
                {t("marketplace.viewDetails")} →
              </Text>
            </BuyerCard>
          </Pressable>
        ))}
        <View style={styles.linkCard}>
          <BuyerCard style={styles.linkInner}>
            <Text style={styles.linkTitle}>{t("marketplace.accountKhataHint")}</Text>
            <Text style={styles.linkBody}>{t("marketplace.accountKhataHintBody")}</Text>
          </BuyerCard>
        </View>
      </View>

      <LanguageSwitcher onChange={() => setLocaleTick((n) => n + 1)} />

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await clearSession();
          replacePath(navigation, "/landing");
        }}
      >
        <Text style={styles.logoutText}>{t("common.signOut")}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgPrimary },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bgPrimary,
    },
    profile: { padding: 16 },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: colors.radiusLg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: "100%", height: "100%" },
    avatarText: { fontSize: 18, fontWeight: "800" },
    name: { fontSize: 18, fontWeight: "800", color: colors.heading },
    email: { color: colors.muted, marginTop: 2, fontSize: 13 },
    linkGrid: { gap: 12 },
    linkCard: {},
    linkInner: { padding: 16, gap: 6 },
    linkHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 4,
    },
    linkIcon: {
      width: 40,
      height: 40,
      borderRadius: colors.radiusLg,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      backgroundColor: colors.danger,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
      minWidth: 22,
      alignItems: "center",
    },
    badgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },
    linkTitle: { fontWeight: "700", color: colors.heading, fontSize: 16 },
    linkBody: { color: colors.body, fontSize: 13, lineHeight: 18 },
    linkCta: { marginTop: 6, fontWeight: "700", fontSize: 13 },
    logout: {
      backgroundColor: colors.danger,
      borderRadius: colors.radiusLg,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    logoutText: { color: colors.white, fontWeight: "700" },
  });
}
