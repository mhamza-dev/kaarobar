import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import SegmentedTabs from "../../components/SegmentedTabs";
import { useBrandPalette } from "../../lib/BrandThemeContext";
import {
  api,
  billingCheckout,
  colors,
  getSession,
  setSession,
  type Session,
} from "../../lib/api";
import { canAccessRoute, isOwner } from "../../lib/rbac";
import { getLocale, loadLocale, setLocale, t, type Locale } from "../../lib/i18n";
import { useToast } from "../../components/Toast";
import { registerForPushNotifications } from "../../lib/push";

type SettingsTab = "profile" | "notifications" | "subscriptions";

type NotificationPrefs = {
  email: boolean;
  in_app: boolean;
  push: boolean;
  muted_types: string[];
};

type Plan = {
  code: string;
  name: string;
  max_businesses: number;
  max_branches: number;
  max_users: number;
  price_display?: string | null;
  price_pkr?: number | null;
  billing_period?: string | null;
  tagline?: string | null;
  features?: string[];
  lemon_variant_id?: string | null;
  checkout_available?: boolean;
  sort_order?: number;
};

type Usage = {
  subscription: {
    plan: string;
    status: string;
    max_businesses: number;
    max_branches: number;
    max_users: number;
    allows_writes?: boolean;
  };
  usage: { businesses: number; branches: number; users: number };
  limits: { max_businesses: number; max_branches: number; max_users: number };
  allows_writes?: boolean;
  plans?: Plan[];
  checkout_url?: string | null;
};

function formatPlanPrice(plan: Plan) {
  if (plan.code === "trial" || plan.billing_period === "trial") {
    return t("settings.planPriceFree");
  }
  if (plan.billing_period === "custom" || plan.price_pkr == null) {
    return plan.price_display || t("settings.planPriceCustom");
  }
  if (plan.price_pkr === 0) {
    return t("settings.planPriceFree");
  }
  const amount = plan.price_pkr.toLocaleString("en-PK");
  return t("settings.planPriceMonth", { amount });
}

const OWNER_TABS: SettingsTab[] = ["profile", "notifications", "subscriptions"];
const STAFF_TABS: SettingsTab[] = ["profile", "notifications"];

export default function SettingsScreen() {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const toast = useToast();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [session, setLocalSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [busy, setBusy] = useState(false);
  const [localeTick, setLocaleTick] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const owner = isOwner(session);
  const visibleTabs = owner ? OWNER_TABS : STAFF_TABS;

  const loadProfile = useCallback(async () => {
    const res = await api<{
      user: {
        name: string;
        email: string;
        phone?: string | null;
        profile_pic_url?: string | null;
      };
    }>("/auth/me");
    setForm({
      name: res.user.name || "",
      email: res.user.email || "",
      phone: res.user.phone || "",
      password: "",
    });
    setPicUrl(res.user.profile_pic_url || null);
  }, []);

  const loadPrefs = useCallback(async () => {
    try {
      const prefRes = await api<{ data: NotificationPrefs }>("/notification-preferences");
      setPrefs(prefRes.data);
    } catch {
      setPrefs(null);
    }
  }, []);

  const loadSubscription = useCallback(async () => {
    if (!owner) return;
    try {
      const res = await api<{ data: Usage }>("/billing/subscription");
      setUsage(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.loadFailed"));
    }
  }, [owner, toast]);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/settings")) {
        router.replace("/app/dashboard");
        return;
      }
      setLocalSession(s);
      try {
        await Promise.all([loadProfile(), loadPrefs(), loadSubscription()]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("profile.loadError"));
      }
    })();
  }, [loadPrefs, loadProfile, loadSubscription, toast]);

  useEffect(() => {
    const raw = typeof params.tab === "string" ? params.tab : "profile";
    if (raw === "subscriptions" && !owner) {
      setTab("profile");
      return;
    }
    if (raw === "profile" || raw === "notifications" || raw === "subscriptions") {
      setTab(raw);
    }
  }, [owner, params.tab]);

  function changeTab(next: SettingsTab) {
    if (next === "subscriptions" && !owner) return;
    setTab(next);
    router.setParams({ tab: next });
  }

  async function pickAndUploadPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", {
        uri: asset.uri,
        name: asset.fileName || "profile.jpg",
        type: asset.mimeType || "image/jpeg",
      } as unknown as Blob);
      const body = await api<{ user: { profile_pic_url?: string | null } }>(
        "/auth/me/profile-pic",
        { method: "POST", body: fd },
      );
      const next = body.user.profile_pic_url || null;
      setPicUrl(next);
      const current = await getSession();
      if (current) {
        await setSession({
          ...current,
          user: { ...current.user, profile_pic_url: next },
        });
      }
      toast.success(t("profile.photoUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    try {
      const body = await api<{ user: { profile_pic_url?: string | null } }>(
        "/auth/me/profile-pic",
        { method: "DELETE" },
      );
      const next = body.user.profile_pic_url || null;
      setPicUrl(next);
      const current = await getSession();
      if (current) {
        await setSession({
          ...current,
          user: { ...current.user, profile_pic_url: next },
        });
      }
      toast.success(t("profile.photoRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function savePrefs(next: NotificationPrefs) {
    setPrefs(next);
    try {
      const res = await api<{ data: NotificationPrefs }>("/notification-preferences", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setPrefs(res.data);
      if (next.push) {
        await registerForPushNotifications().catch(() => null);
      }
      toast.success(t("settings.notificationsSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  function togglePref(key: keyof Pick<NotificationPrefs, "email" | "in_app" | "push">) {
    if (!prefs) return;
    void savePrefs({ ...prefs, [key]: !prefs[key] });
  }

  async function onSaveProfile() {
    setBusy(true);
    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
      };
      if (form.password.trim()) body.password = form.password;

      const res = await api<{
        user: {
          id: string;
          name: string;
          email: string;
          phone?: string | null;
        };
      }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      const current = await getSession();
      if (current) {
        await setSession({
          ...current,
          user: {
            ...current.user,
            name: res.user.name,
            email: res.user.email,
            phone: res.user.phone,
            profile_pic_url: picUrl,
          },
        });
      }
      setForm((f) => ({ ...f, password: "" }));
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function upgradePlan(plan: Plan) {
    if (plan.code === "trial") return;
    if (plan.checkout_available === false) {
      toast.error(t("settings.contactSales"));
      return;
    }
    setCheckoutBusy(plan.code);
    try {
      const res = await billingCheckout(plan.code);
      if (res.data?.checkout_url) {
        await Linking.openURL(res.data.checkout_url);
      } else {
        toast.error(
          plan.code === "enterprise"
            ? t("settings.contactSales")
            : t("settings.billingNotConfigured"),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      if (plan.code === "enterprise" || /not_configured|invalid_plan/i.test(message)) {
        toast.error(t("settings.contactSales"));
      } else {
        toast.error(message);
      }
    } finally {
      setCheckoutBusy(null);
    }
  }

  void localeTick;
  const sub = usage?.subscription;
  const allowsWrites = usage?.allows_writes ?? sub?.allows_writes ?? true;
  const plans = [...(usage?.plans || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  return (
    <>
      <Stack.Screen options={{ title: t("pages.settingsTitle") }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t("common.workspace")}</Text>
        <Text style={styles.title}>{t("pages.settingsTitle")}</Text>
        <Text style={styles.sub}>{t("pages.settingsDesc")}</Text>

        <SegmentedTabs
          tabs={visibleTabs.map((id) => ({
            id,
            label:
              id === "profile"
                ? t("settings.tabProfile")
                : id === "notifications"
                  ? t("settings.tabNotifications")
                  : t("settings.tabSubscriptions"),
          }))}
          value={tab}
          onChange={(id) => changeTab(id as SettingsTab)}
        />

        {tab === "profile" ? (
          <View style={styles.section}>
            <View style={styles.photoRow}>
              {picUrl ? (
                <Image source={{ uri: picUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>
                    {(form.name || "?").trim().slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable style={styles.secondaryBtn} onPress={pickAndUploadPhoto} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>
                    {picUrl ? t("profile.changePhoto") : t("profile.uploadPhoto")}
                  </Text>
                </Pressable>
                {picUrl ? (
                  <Pressable style={styles.secondaryBtn} onPress={removePhoto} disabled={busy}>
                    <Text style={styles.secondaryBtnText}>{t("profile.removePhoto")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Text style={styles.label}>{t("profile.name")}</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
            />

            <Text style={styles.label}>{t("profile.email")}</Text>
            <TextInput style={[styles.input, styles.disabled]} value={form.email} editable={false} />
            <Text style={styles.hint}>{t("profile.emailHint")}</Text>

            <Text style={styles.label}>{t("profile.phone")}</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(phone) => setForm({ ...form, phone })}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t("common.language")}</Text>
            <View style={styles.chips}>
              {(["en", "ur"] as Locale[]).map((code) => {
                const active = getLocale() === code;
                return (
                  <Pressable
                    key={code}
                    style={[styles.chip, active && styles.chipOn]}
                    onPress={async () => {
                      await setLocale(code);
                      setLocaleTick((n) => n + 1);
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>
                      {code === "ur" ? t("common.urdu") : t("common.english")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t("profile.newPassword")}</Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(password) => setForm({ ...form, password })}
              secureTextEntry
            />
            <Text style={styles.hint}>{t("profile.newPasswordHint")}</Text>

            <Pressable style={styles.btn} onPress={onSaveProfile} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.btnText}>{t("profile.save")}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {tab === "notifications" ? (
          <View style={styles.section}>
            <Text style={styles.hint}>{t("settings.notificationsDesc")}</Text>
            {prefs ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {(
                  [
                    ["email", t("settings.prefEmail")],
                    ["in_app", t("settings.prefInApp")],
                    ["push", t("settings.prefPush")],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={[styles.chip, prefs[key] && styles.chipOn]}
                    onPress={() => togglePref(key)}
                  >
                    <Text style={[styles.chipText, prefs[key] && styles.chipTextOn]}>
                      {prefs[key] ? t("settings.prefOn") : t("settings.prefOff")} · {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>{t("common.loading")}</Text>
            )}
          </View>
        ) : null}

        {tab === "subscriptions" && owner && sub ? (
          <View style={styles.section}>
            {!allowsWrites ? (
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>{t("settings.writesDisabledBanner")}</Text>
                <Text style={styles.hint}>{t("settings.writesDisabledHint")}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("settings.subscription")}</Text>
              <Text style={styles.cardBody}>
                {t("settings.plan")} {sub.plan} · {sub.status}
              </Text>
              <Text style={[styles.cardBody, { marginTop: 6 }]}>{t("settings.billingHint")}</Text>
              <View style={styles.meterRow}>
                {(
                  [
                    [t("settings.businesses"), usage!.usage.businesses, usage!.limits.max_businesses],
                    [t("settings.branches"), usage!.usage.branches, usage!.limits.max_branches],
                    [t("settings.users"), usage!.usage.users, usage!.limits.max_users],
                  ] as const
                ).map(([label, used, max]) => (
                  <View key={label} style={styles.meter}>
                    <Text style={styles.meterLabel}>{label}</Text>
                    <Text style={styles.meterValue}>
                      {used} / {max}
                    </Text>
                  </View>
                ))}
              </View>
              {usage?.checkout_url ? (
                <Pressable
                  style={styles.btn}
                  onPress={() => void Linking.openURL(usage.checkout_url!)}
                >
                  <Text style={styles.btnText}>{t("settings.manageBilling")}</Text>
                </Pressable>
              ) : null}
            </View>

            {plans.map((plan) => {
              const current = plan.code === sub.plan;
              const features =
                plan.features && plan.features.length > 0
                  ? plan.features
                  : [
                      `${t("settings.businesses")}: ${plan.max_businesses}`,
                      `${t("settings.branches")}: ${plan.max_branches}`,
                      `${t("settings.users")}: ${plan.max_users}`,
                    ];
              return (
                <View key={plan.code} style={[styles.card, current && styles.cardCurrent]}>
                  <View style={styles.planHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{plan.name}</Text>
                      <Text style={styles.planPrice}>{formatPlanPrice(plan)}</Text>
                      {plan.tagline ? (
                        <Text style={styles.cardBody}>{plan.tagline}</Text>
                      ) : null}
                    </View>
                    {current ? (
                      <Text style={styles.currentBadge}>{t("settings.currentPlan")}</Text>
                    ) : null}
                  </View>
                  <View style={styles.featureList}>
                    {features.map((feature) => (
                      <Text key={feature} style={styles.featureItem}>
                        • {feature}
                      </Text>
                    ))}
                  </View>
                  {!current && plan.code !== "trial" ? (
                    <Pressable
                      style={styles.btn}
                      disabled={checkoutBusy === plan.code}
                      onPress={() => void upgradePlan(plan)}
                    >
                      {checkoutBusy === plan.code ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.btnText}>
                          {plan.checkout_available === false
                            ? t("settings.contactSales")
                            : t("settings.getStarted")}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

            <Pressable style={styles.linkCard} onPress={() => router.push("/app/businesses")}>
              <Text style={styles.linkTitle}>{t("nav.businesses")}</Text>
              <Text style={styles.hint}>{t("settings.manageBusinessesHint")}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function createStyles(palette: import("../../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    content: { padding: 20, paddingBottom: 40 },
    eyebrow: {
      color: palette.brand,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    title: { marginTop: 6, fontSize: 24, fontWeight: "800", color: colors.heading },
    sub: { marginTop: 6, color: colors.body, marginBottom: 8 },
    section: { marginTop: 4 },
    photoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8 },
    avatar: { width: 72, height: 72, borderRadius: 14 },
    avatarFallback: {
      backgroundColor: palette.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.white, fontWeight: "800", fontSize: 24 },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
    },
    secondaryBtnText: { color: colors.heading, fontWeight: "700", textAlign: "center" },
    label: { marginTop: 12, marginBottom: 6, fontWeight: "600", color: colors.heading },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.heading,
    },
    disabled: { backgroundColor: palette.brandLight, color: colors.muted },
    hint: { marginTop: 4, fontSize: 12, color: colors.muted, lineHeight: 18 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.card,
    },
    chipOn: { backgroundColor: palette.brand, borderColor: palette.brand },
    chipText: { fontWeight: "700", color: colors.heading },
    chipTextOn: { color: colors.white },
    btn: {
      marginTop: 16,
      backgroundColor: palette.brand,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnText: { color: colors.white, fontWeight: "700" },
    card: {
      marginTop: 12,
      backgroundColor: colors.glass,
      borderRadius: colors.radiusLg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    cardCurrent: { borderColor: palette.brand, borderWidth: 2 },
    cardTitle: { fontWeight: "800", color: colors.heading, fontSize: 16 },
    cardBody: { marginTop: 4, color: colors.body, fontSize: 13, lineHeight: 20 },
    planPrice: {
      marginTop: 4,
      color: colors.heading,
      fontSize: 14,
      fontWeight: "700",
    },
    featureList: { marginTop: 10, gap: 4 },
    featureItem: { color: colors.body, fontSize: 13, lineHeight: 19 },
    meterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    meter: {
      flexGrow: 1,
      minWidth: "30%",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: colors.radiusLg,
      padding: 10,
      backgroundColor: colors.bgPrimary,
    },
    meterLabel: { fontSize: 12, color: colors.body },
    meterValue: { marginTop: 4, fontSize: 18, fontWeight: "700", color: colors.heading },
    planHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    currentBadge: {
      backgroundColor: palette.brandSoft,
      color: palette.brand,
      fontWeight: "700",
      fontSize: 11,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      overflow: "hidden",
    },
    banner: {
      marginTop: 8,
      padding: 12,
      borderRadius: colors.radiusLg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: palette.brandLight,
    },
    bannerTitle: { fontWeight: "700", color: colors.heading, fontSize: 14 },
    linkCard: {
      marginTop: 12,
      padding: 14,
      borderRadius: colors.radiusLg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    linkTitle: { fontWeight: "800", color: palette.brand, fontSize: 16 },
  });
}
