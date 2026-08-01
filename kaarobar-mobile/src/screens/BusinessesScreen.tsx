import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, getSession } from "../lib/api";
import { canAccessRoute } from "../lib/rbac";
import { loadLocale, t } from "../lib/i18n";
import { useToast } from "../components/Toast";
import { FormModal } from "../components/FormModal";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";

type Business = {
  id: string;
  name: string;
  industry?: string | null;
  is_active?: boolean;
  tagline?: string | null;
};

const INDUSTRIES = [
  "retail",
  "restaurant",
  "salon",
  "pharmacy",
  "supermarket",
  "wholesale",
  "general",
];

export default function BusinessesScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const toast = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "retail", tagline: "" });

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Business[] }>("/businesses?include_inactive=true");
      setBusinesses(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/businesses")) {
        replacePath(navigation, "/app/dashboard");
        return;
      }
      await load();
    })();
  }, [load]);

  async function create() {
    setBusy(true);
    try {
      const res = await api<{ data: Business }>("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry,
          tagline: form.tagline.trim() || null,
        }),
      });
      setModal(false);
      setForm({ name: "", industry: "retail", tagline: "" });
      toast.success(t("businesses.created"));
      await load();
      if (res.data?.id) pushPath(navigation, `/app/businesses/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("pages.businessesTitle")}</Text>
        <Text style={styles.sub}>{t("pages.businessesDesc")}</Text>

        <Pressable style={styles.btn} onPress={() => setModal(true)}>
          <Text style={styles.btnText}>{t("businesses.add")}</Text>
        </Pressable>

        {businesses.length === 0 ? (
          <Text style={styles.hint}>{t("businesses.emptyBody")}</Text>
        ) : (
          businesses.map((b) => (
            <Pressable
              key={b.id}
              style={styles.card}
              onPress={() => pushPath(navigation, `/app/businesses/${b.id}`)}
            >
              <Text style={styles.cardTitle}>{b.name}</Text>
              <Text style={styles.cardBody}>
                {b.industry || "—"} ·{" "}
                {b.is_active === false
                  ? t("businesses.inactive")
                  : t("businesses.active")}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <FormModal
        visible={modal}
        title={t("businesses.add")}
        onClose={() => setModal(false)}
        onSubmit={() => void create()}
        busy={busy}
        submitLabel={t("common.create")}
      >
        <Text style={styles.label}>{t("common.name")}</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(name) => setForm({ ...form, name })}
        />
        <Text style={styles.label}>{t("businesses.industry")}</Text>
        <View style={styles.chips}>
          {INDUSTRIES.map((ind) => (
            <Pressable
              key={ind}
              style={[styles.chip, form.industry === ind && styles.chipOn]}
              onPress={() => setForm({ ...form, industry: ind })}
            >
              <Text style={[styles.chipText, form.industry === ind && styles.chipTextOn]}>
                {ind}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>{t("businesses.tagline")}</Text>
        <TextInput
          style={styles.input}
          value={form.tagline}
          onChangeText={(tagline) => setForm({ ...form, tagline })}
        />
      </FormModal>
    </>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    content: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 24, fontWeight: "800", color: colors.heading },
    sub: { marginTop: 6, marginBottom: 12, color: colors.body },
    hint: { marginTop: 12, color: colors.muted },
    btn: {
      backgroundColor: palette.brand,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
      marginBottom: 12,
    },
    btnText: { color: colors.white, fontWeight: "700" },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      backgroundColor: colors.card,
    },
    cardTitle: { fontWeight: "800", color: colors.heading, fontSize: 16 },
    cardBody: { marginTop: 4, color: colors.body },
    label: { marginTop: 10, marginBottom: 6, fontWeight: "600", color: colors.heading },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.heading,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.card,
    },
    chipOn: { backgroundColor: palette.brand, borderColor: palette.brand },
    chipText: { fontWeight: "600", color: colors.heading, fontSize: 12 },
    chipTextOn: { color: colors.white },
  });
}
