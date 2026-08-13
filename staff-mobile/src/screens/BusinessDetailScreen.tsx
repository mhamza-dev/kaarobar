import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { pickImageFromLibrary } from "@/lib/imagePicker";
import { type Theme, useTheme } from "@/theme";
import { api, getSession } from "@/lib/api";
import { isOwner } from "@/lib/rbac";
import { loadLocale, t } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { goBack, replacePath } from "@/lib/nav";
import CustomForm from "@/components/form/custom-form";
import { FormikTextField } from "@/components/form/form-fields";
import {
  branchFormSchema,
  businessDetailFormSchema,
  emptyBranchForm,
  emptyBusinessDetailForm,
  type BranchFormValues,
  type BusinessDetailFormValues,
} from "@/lib/validations/businesses";

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
  const routeParams = useLocalSearchParams();
  const { id } = (routeParams) as { id: string };
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toast = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [detailInitial, setDetailInitial] = useState(emptyBusinessDetailForm());
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
      setDetailInitial({
        name: biz.data.name || "",
        industry: biz.data.industry || "general",
        tagline: biz.data.tagline || "",
        primary_color: biz.data.primary_color || "",
        marketplace_description: biz.data.marketplace_description || "",
      });
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
        replacePath("/landing");
        return;
      }
      if (!isOwner(s)) {
        replacePath("/app/dashboard");
        return;
      }
      await load();
    })();
  }, [load]);

  async function saveBusiness(values: BusinessDetailFormValues) {
    if (!business) return;
    setBusy(true);
    try {
      const res = await api<{ data: Business }>(`/businesses/${business.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name.trim(),
          industry: values.industry || null,
          tagline: values.tagline.trim() || null,
          primary_color: values.primary_color.trim() || null,
          marketplace_description: values.marketplace_description.trim() || null,
        }),
      });
      setBusiness(res.data);
      setDetailInitial({
        name: res.data.name || "",
        industry: res.data.industry || "general",
        tagline: res.data.tagline || "",
        primary_color: res.data.primary_color || "",
        marketplace_description: res.data.marketplace_description || "",
      });
      toast.success(t("businesses.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo() {
    if (!business) return;
    const asset = await pickImageFromLibrary();
    if (!asset) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("logo", {
        uri: asset.uri,
        name: asset.fileName || "logo.jpg",
        type: asset.type || "image/jpeg",
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

  async function createBranch(values: BranchFormValues, resetForm: () => void) {
    if (!business) return;
    setBusy(true);
    try {
      await api(`/businesses/${business.id}/branches`, {
        method: "POST",
        body: JSON.stringify({ name: values.name.trim() }),
      });
      resetForm();
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
      <View style={styles.center}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.sub}>{t("businesses.notFound")}</Text>
        <Pressable style={styles.btn} onPress={() => goBack()}>
          <Text style={styles.btnText}>{t("businesses.back")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {business.is_active === false ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t("businesses.inactiveBanner")}</Text>
        </View>
      ) : null}

      <Pressable onPress={() => goBack()}>
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

      <CustomForm
        initialValues={detailInitial}
        validationSchema={businessDetailFormSchema}
        enableReinitialize
        onSubmit={saveBusiness}
      >
        {({ handleSubmit }) => (
          <>
            <FormikTextField name="name" label={t("businesses.name")} style={styles.input} />
            <FormikTextField
              name="tagline"
              label={t("businesses.tagline")}
              style={styles.input}
              placeholder={t("businesses.taglinePlaceholder")}
            />
            <FormikTextField
              name="primary_color"
              label={t("businesses.brandColor")}
              style={styles.input}
              placeholder="#1d4ed8"
              autoCapitalize="none"
            />
            <FormikTextField
              name="marketplace_description"
              label={t("businesses.marketplaceDescription")}
              style={[styles.input, { minHeight: 80 }]}
              multiline
              placeholder={t("businesses.marketplaceDescriptionPlaceholder")}
            />
            <Pressable style={styles.btn} onPress={() => handleSubmit()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <Text style={styles.btnText}>{t("common.save")}</Text>
              )}
            </Pressable>
          </>
        )}
      </CustomForm>

      <Text style={styles.sectionTitle}>{t("settings.branches")}</Text>
      <CustomForm
        initialValues={emptyBranchForm()}
        validationSchema={branchFormSchema}
        onSubmit={async (values, helpers) => {
          await createBranch(values, () => helpers.resetForm({ values: emptyBranchForm() }));
        }}
      >
        {({ handleSubmit }) => (
          <>
            <FormikTextField
              name="name"
              label={t("businesses.branchName")}
              style={styles.input}
              placeholder={t("businesses.branchNamePlaceholder")}
            />
            <Pressable style={styles.secondaryBtn} onPress={() => handleSubmit()} disabled={busy}>
              <Text style={styles.secondaryBtnText}>{t("businesses.addBranch")}</Text>
            </Pressable>
          </>
        )}
      </CustomForm>

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
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    screen: { flex: 1, backgroundColor: t.bgPrimary },
    content: { padding: 20, paddingBottom: 40 },
    backLink: { color: t.brand, fontWeight: "700", marginBottom: 12 },
    banner: {
      backgroundColor: t.brandLight,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    bannerText: { color: t.heading, fontWeight: "600", fontSize: 13 },
    logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
    logo: { width: 72, height: 72, borderRadius: 12 },
    logoFallback: {
      backgroundColor: t.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: { color: t.white, fontWeight: "800", fontSize: 24 },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.heading,
      backgroundColor: t.card,
      marginBottom: 8,
    },
    sub: { marginTop: 8, color: t.body, fontSize: 13 },
    btn: {
      marginTop: 16,
      backgroundColor: t.brand,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnText: { color: t.white, fontWeight: "700" },
    secondaryBtn: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: t.card,
    },
    secondaryBtnText: { color: t.heading, fontWeight: "700" },
    sectionTitle: {
      marginTop: 24,
      marginBottom: 4,
      fontSize: 18,
      fontWeight: "800",
      color: t.heading,
    },
    branchRow: {
      marginTop: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.card,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    branchName: { fontWeight: "700", color: t.heading },
    deactivate: { color: t.danger, fontWeight: "700", fontSize: 12 },
  });
}
