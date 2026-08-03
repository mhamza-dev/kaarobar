import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase, RouteProp } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { t } from "../lib/i18n";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { pushPath } from "../lib/nav";

type MsgTemplate = {
  id: string;
  name: string;
  channel: string;
  title_template: string;
  body_template: string;
  variables: Record<string, string>;
};

type Params = { id: string };

export default function TemplateDetailScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const id = route.params?.id;
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(), []);
  const [template, setTemplate] = useState<MsgTemplate | null>(null);
  const [preview, setPreview] = useState<{ title: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [tplRes, varsRes] = await Promise.all([
        api<{ data: MsgTemplate }>(`/crm/templates/${id}`),
        api<{ data: { sample_values: Record<string, string> } }>("/crm/templates/variables"),
      ]);
      const tpl = tplRes.data;
      setTemplate(tpl);
      const sample = {
        ...(varsRes.data?.sample_values || {}),
        ...(tpl.variables || {}),
      };
      const rendered = await api<{ data: { title: string; message: string } }>(
        "/crm/templates/preview",
        {
          method: "POST",
          body: JSON.stringify({
            channel: tpl.channel,
            title_template: tpl.title_template,
            body_template: tpl.body_template,
            variables: sample,
          }),
        }
      );
      setPreview(rendered.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable
        onPress={() => pushPath(navigation, "/app/marketing", { tab: "templates" })}
        style={{ marginBottom: 12 }}
      >
        <Text style={{ color: palette.brand, fontWeight: "700" }}>
          ← {t("marketing.backToTemplates")}
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.title}>{template?.name || t("marketing.templateFallback")}</Text>
      <Text style={styles.meta}>{template?.channel}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("marketing.overview")}</Text>
        <Text style={styles.meta}>{t("marketing.titleTemplate")}</Text>
        <Text style={styles.body}>{template?.title_template}</Text>
        <Text style={[styles.meta, { marginTop: 8 }]}>{t("marketing.bodyTemplate")}</Text>
        <Text style={styles.body}>{template?.body_template}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("marketing.templatePreview")}</Text>
        <Text style={styles.meta}>{t("marketing.sampleValues")}</Text>
        {preview ? (
          <>
            <Text style={[styles.body, { fontWeight: "700", marginTop: 8 }]}>{preview.title}</Text>
            <Text style={styles.body}>{preview.message}</Text>
            {template?.channel === "sms" ? (
              <Text style={styles.meta}>
                {t("marketing.charsCount", { count: preview.message.length })}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 22, fontWeight: "800", color: colors.heading },
    error: { color: colors.danger, marginBottom: 8 },
    meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
    body: { fontSize: 14, color: colors.body, lineHeight: 20, marginTop: 4 },
    card: {
      marginTop: 14,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.heading, marginBottom: 6 },
  });
}
