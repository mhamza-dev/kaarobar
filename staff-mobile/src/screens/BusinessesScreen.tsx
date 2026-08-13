import { useCallback, useEffect, useMemo, useState } from "react";
import { type Theme, useTheme } from "@/theme";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useField } from "formik";
import { api, getSession } from "@/lib/api";
import { canAccessRoute } from "@/lib/rbac";
import { loadLocale, t } from "@shared/i18n";
import { useToast } from "@shared/ui/toast";
import EntityFormModal from "@/components/screen/entity-form-modal";
import { FormikTextField } from "@shared/form/form-fields";
import {
  businessCreateFormSchema,
  emptyBusinessCreateForm,
  type BusinessCreateFormValues,
} from "@core/validations/businesses";
import { replacePath, pushPath } from "@/lib/nav";

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

function IndustryChips({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const [field, , helpers] = useField<string>("industry");
  return (
    <View style={styles.chips}>
      {INDUSTRIES.map((ind) => (
        <Pressable
          key={ind}
          style={[styles.chip, field.value === ind && styles.chipOn]}
          onPress={() => void helpers.setValue(ind)}
        >
          <Text style={[styles.chipText, field.value === ind && styles.chipTextOn]}>
            {ind}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function BusinessesScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toast = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);

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
        replacePath("/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/businesses")) {
        replacePath("/app/dashboard");
        return;
      }
      await load();
    })();
  }, [load]);

  async function create(values: BusinessCreateFormValues) {
    setBusy(true);
    try {
      const res = await api<{ data: Business }>("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          industry: values.industry,
          tagline: values.tagline.trim() || null,
          tax_jurisdiction: values.tax_jurisdiction || "PK",
        }),
      });
      setModal(false);
      toast.success(t("businesses.created"));
      await load();
      if (res.data?.id) pushPath(`/app/businesses/${res.data.id}`);
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
              onPress={() => pushPath(`/app/businesses/${b.id}`)}
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

      <EntityFormModal
        visible={modal}
        title={t("businesses.add")}
        onClose={() => setModal(false)}
        busy={busy}
        submitLabel={t("common.create")}
        initialValues={emptyBusinessCreateForm()}
        validationSchema={businessCreateFormSchema}
        onSubmit={async (values) => {
          await create(values);
        }}
      >
        {() => (
          <>
            <FormikTextField name="name" label={t("common.name")} style={styles.input} />
            <Text style={styles.label}>{t("businesses.industry")}</Text>
            <IndustryChips styles={styles} />
            <FormikTextField
              name="tagline"
              label={t("businesses.tagline")}
              style={styles.input}
            />
          </>
        )}
      </EntityFormModal>
    </>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bgPrimary },
    content: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 24, fontWeight: "800", color: t.heading },
    sub: { marginTop: 6, marginBottom: 12, color: t.body },
    hint: { marginTop: 12, color: t.muted },
    btn: {
      backgroundColor: t.brand,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
      marginBottom: 12,
    },
    btnText: { color: t.white, fontWeight: "700" },
    card: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      backgroundColor: t.card,
    },
    cardTitle: { fontWeight: "800", color: t.heading, fontSize: 16 },
    cardBody: { marginTop: 4, color: t.body },
    label: { marginTop: 10, marginBottom: 6, fontWeight: "600", color: t.heading },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.heading,
      marginBottom: 8,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    chip: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: t.card,
    },
    chipOn: { backgroundColor: t.brand, borderColor: t.brand },
    chipText: { fontWeight: "600", color: t.heading, fontSize: 12 },
    chipTextOn: { color: t.white },
  });
}
