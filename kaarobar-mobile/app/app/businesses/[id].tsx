import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useBrandPalette } from "../../../lib/BrandThemeContext";
import { api, colors, getSession } from "../../../lib/api";
import { isOwner } from "../../../lib/rbac";
import { loadLocale, t } from "../../../lib/i18n";
import { useToast } from "../../../components/Toast";

type Business = {
  id: string;
  name: string;
  industry?: string | null;
  is_active?: boolean;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
};

type Branch = {
  id: string;
  name: string;
  is_active?: boolean;
};

function planLimitMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  if (code === "plan_limit_reached") return t("businesses.planLimitReached");
  if (code === "subscription_inactive") return t("businesses.subscriptionInactive");
  return err instanceof Error ? err.message : t("common.error");
}

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const toast = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchName, setBranchName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [biz, br] = await Promise.all([
        api<{ data: Business }>(`/businesses/${id}`),
        api<{ data: Branch[] }>(`/businesses/${id}/branches?include_inactive=true`),
      ]);
      setBusiness(biz.data);
      setBranches(br.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (!isOwner(s)) {
        router.replace("/app/dashboard");
        return;
      }
      await load();
    })();
  }, [load]);

  async function saveBusiness() {
    if (!business) return;
    setBusy(true);
    try {
      const res = await api<{ data: Business }>(`/businesses/${business.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: business.name,
          industry: business.industry || null,
          tagline: business.tagline || null,
          primary_color: business.primary_color || null,
          marketplace_description: business.marketplace_description || null,
        }),
      });
      setBusiness(res.data);
      toast.success(t("businesses.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo() {
    if (!business) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("logo", {
        uri: asset.uri,
        name: asset.fileName || "logo.jpg",
        type: asset.mimeType || "image/jpeg",
      } as unknown as Blob);
      const body = await api<{ data: Business }>(`/businesses/${business.id}/logo`, {
        method: "POST",
        body: fd,
      });
      setBusiness(body.data);
      toast.success(t("businesses.logoUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function clearLogo() {
    if (!business) return;
    setBusy(true);
    try {
      const body = await api<{ data: Business }>(`/businesses/${business.id}/logo`, {
        method: "DELETE",
      });
      setBusiness(body.data);
      toast.success(t("businesses.logoRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function createBranch() {
    if (!business || !branchName.trim()) return;
    setBusy(true);
    try {
      await api(`/businesses/${business.id}/branches`, {
        method: "POST",
        body: JSON.stringify({ name: branchName.trim() }),
      });
      setBranchName("");
      toast.success(t("businesses.branchCreated"));
      await load();
    } catch (err) {
      toast.error(planLimitMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function deactivateBranch(branch: Branch) {
    Alert.alert(t("businesses.deactivate"), t("businesses.deactivateBranchConfirm", { name: branch.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("businesses.deactivate"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await api(`/businesses/${id}/branches/${branch.id}/deactivate`, {
                method: "POST",
                body: "{}",
              });
              toast.success(t("businesses.branchDeactivated"));
              await load();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : t("common.error"));
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("pages.businessDetailTitle") }} />
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand} />
        </View>
      </>
    );
  }

  if (!business) {
    return (
      <>
        <Stack.Screen options={{ title: t("pages.businessDetailTitle") }} />
        <View style={styles.center}>
          <Text style={styles.sub}>{t("businesses.notFound")}</Text>
          <Pressable style={styles.btn} onPress={() => router.back()}>
            <Text style={styles.btnText}>{t("businesses.back")}</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: business.name }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {business.is_active === false ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{t("businesses.inactiveBanner")}</Text>
          </View>
        ) : null}

        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>{t("businesses.back")}</Text>
        </Pressable>

        <View style={styles.logoRow}>
          {business.logo_url ? (
            <Image source={{ uri: business.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoText}>{business.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable style={styles.secondaryBtn} onPress={uploadLogo} disabled={busy}>
              <Text style={styles.secondaryBtnText}>{t("businesses.uploadLogo")}</Text>
            </Pressable>
            {business.logo_url ? (
              <Pressable style={styles.secondaryBtn} onPress={clearLogo} disabled={busy}>
                <Text style={styles.secondaryBtnText}>{t("businesses.removeLogo")}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.label}>{t("businesses.name")}</Text>
        <TextInput
          style={styles.input}
          value={business.name}
          onChangeText={(name) => setBusiness({ ...business, name })}
        />

        <Text style={styles.label}>{t("businesses.tagline")}</Text>
        <TextInput
          style={styles.input}
          value={business.tagline || ""}
          onChangeText={(tagline) => setBusiness({ ...business, tagline })}
          placeholder={t("businesses.taglinePlaceholder")}
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>{t("businesses.brandColor")}</Text>
        <TextInput
          style={styles.input}
          value={business.primary_color || ""}
          onChangeText={(primary_color) => setBusiness({ ...business, primary_color })}
          placeholder="#1d4ed8"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t("businesses.marketplaceDescription")}</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          multiline
          value={business.marketplace_description || ""}
          onChangeText={(marketplace_description) =>
            setBusiness({ ...business, marketplace_description })
          }
          placeholder={t("businesses.marketplaceDescriptionPlaceholder")}
          placeholderTextColor={colors.muted}
        />

        <Pressable style={styles.btn} onPress={saveBusiness} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>{t("common.save")}</Text>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>{t("settings.branches")}</Text>
        <Text style={styles.label}>{t("businesses.branchName")}</Text>
        <TextInput
          style={styles.input}
          value={branchName}
          onChangeText={setBranchName}
          placeholder={t("businesses.branchNamePlaceholder")}
          placeholderTextColor={colors.muted}
        />
        <Pressable style={styles.secondaryBtn} onPress={createBranch} disabled={busy}>
          <Text style={styles.secondaryBtnText}>{t("businesses.addBranch")}</Text>
        </Pressable>

        {branches.length === 0 ? (
          <Text style={styles.sub}>{t("businesses.noBranches")}</Text>
        ) : (
          branches.map((branch) => (
            <View key={branch.id} style={styles.branchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.branchName}>{branch.name}</Text>
                {branch.is_active === false ? (
                  <Text style={styles.sub}>{t("businesses.inactive")}</Text>
                ) : null}
              </View>
              {branch.is_active !== false ? (
                <Pressable onPress={() => deactivateBranch(branch)}>
                  <Text style={styles.deactivate}>{t("businesses.deactivate")}</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

function createStyles(palette: import("../../../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    content: { padding: 20, paddingBottom: 40 },
    backLink: { color: palette.brand, fontWeight: "700", marginBottom: 12 },
    banner: {
      backgroundColor: palette.brandLight,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerText: { color: colors.heading, fontWeight: "600", fontSize: 13 },
    logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
    logo: { width: 72, height: 72, borderRadius: 12 },
    logoFallback: {
      backgroundColor: palette.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: { color: colors.white, fontWeight: "800", fontSize: 24 },
    label: { marginTop: 12, marginBottom: 6, fontWeight: "600", color: colors.heading },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.heading,
      backgroundColor: colors.card,
    },
    sub: { marginTop: 8, color: colors.body, fontSize: 13 },
    btn: {
      marginTop: 16,
      backgroundColor: palette.brand,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnText: { color: colors.white, fontWeight: "700" },
    secondaryBtn: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    secondaryBtnText: { color: colors.heading, fontWeight: "700" },
    sectionTitle: {
      marginTop: 24,
      marginBottom: 4,
      fontSize: 18,
      fontWeight: "800",
      color: colors.heading,
    },
    branchRow: {
      marginTop: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    branchName: { fontWeight: "700", color: colors.heading },
    deactivate: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  });
}
