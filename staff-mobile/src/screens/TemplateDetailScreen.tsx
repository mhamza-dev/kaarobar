import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, getSession } from "@/lib/api";
import { t } from "@/lib/i18n";
import { type Theme, useTheme } from "@/theme";
import { pushPath } from "@/lib/nav";
import { crmKeys } from "@/lib/queryClient";

type MsgTemplate = {
  id: string;
  name: string;
  channel: string;
  title_template: string;
  body_template: string;
  variables: Record<string, string>;
};


export default function TemplateDetailScreen() {
  const routeParams = useLocalSearchParams();
  const id = routeParams.id;
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    void getSession().then((s) => setBusinessId(s?.business_id ?? null));
  }, []);

  const templateQuery = useQuery({
    queryKey: [...crmKeys.templates(businessId), id] as const,
    queryFn: async () => {
      const [tplRes, varsRes] = await Promise.all([
        api<{ data: MsgTemplate }>(`/crm/templates/${id}`),
        api<{ data: { sample_values: Record<string, string> } }>("/crm/templates/variables"),
      ]);
      const tpl = tplRes.data;
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
      return { template: tpl, preview: rendered.data };
    },
    enabled: !!id && !!businessId,
  });

  const template = templateQuery.data?.template ?? null;
  const preview = templateQuery.data?.preview ?? null;
  const loading = templateQuery.isLoading || (!!id && !businessId);
  const error = templateQuery.error
    ? templateQuery.error instanceof Error
      ? templateQuery.error.message
      : t("common.loadFailed")
    : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.brandOn} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable
        onPress={() => pushPath("/app/marketing", { tab: "templates" })}
        style={{ marginBottom: 12 }}
      >
        <Text style={{ color: theme.brandOn, fontWeight: "700" }}>
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

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary, padding: 16 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 22, fontWeight: "800", color: t.heading },
    error: { color: t.danger, marginBottom: 8 },
    meta: { fontSize: 13, color: t.muted, marginTop: 4 },
    body: { fontSize: 14, color: t.body, lineHeight: 20, marginTop: 4 },
    card: {
      marginTop: 14,
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: t.heading, marginBottom: 6 },
  });
}
