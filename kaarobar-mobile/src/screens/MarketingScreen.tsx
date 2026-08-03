import { useEffect, useMemo, useState } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, colors, getSession } from "../lib/api";
import { canAccessRoute, isPlanFeatureLocked } from "../lib/rbac";
import { t } from "../lib/i18n";
import { useToast } from "../components/Toast";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import SegmentedTabs from "../components/SegmentedTabs";
import { FormModal } from "../components/FormModal";
import { useTabParam } from "../hooks/useTabParam";
import { crmKeys } from "../lib/queryClient";

type Campaign = {
  id: string;
  name: string;
  title: string;
  message: string;
  audience: string;
  channel?: string;
  min_points?: number | null;
  status: string;
  sent_at?: string | null;
  recipient_count?: number;
  delivery?: { notified: number; email_only: number; skipped: number };
};

type MsgTemplate = {
  id: string;
  name: string;
  channel: string;
  title_template: string;
  body_template: string;
  variables: Record<string, string>;
};

type TemplateVariable = {
  key: string;
  placeholder: string;
  source: string;
  example: string;
};

type Tab = "campaigns" | "templates";
const MARKETING_TABS: readonly Tab[] = ["campaigns", "templates"];

const emptyTplForm = {
  name: "",
  channel: "email",
  title_template: "",
  body_template: "",
};

export default function MarketingScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useTabParam<Tab>("campaigns", MARKETING_TABS);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [form, setForm] = useState({
    name: "",
    title: "",
    message: "",
    audience: "all",
    min_points: "",
  });
  const [tplForm, setTplForm] = useState(emptyTplForm);
  const [tplModal, setTplModal] = useState(false);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/marketing")) {
        if (isPlanFeatureLocked(s, "/app/marketing")) {
          toast.error(t("rbac.planFeatureLocked"));
        }
        replacePath(navigation, "/app/dashboard");
        return;
      }
      setBusinessId(s.business_id ?? null);
      setAllowed(true);
    })();
  }, [navigation, toast]);

  const campaignsQuery = useQuery({
    queryKey: crmKeys.campaigns(businessId),
    queryFn: async () => {
      const res = await api<{ data: Campaign[] }>("/crm/campaigns");
      return res.data || [];
    },
    enabled: allowed && tab === "campaigns" && !!businessId,
  });

  const templatesQuery = useQuery({
    queryKey: crmKeys.templates(businessId),
    queryFn: async () => {
      const res = await api<{ data: MsgTemplate[] }>("/crm/templates");
      return res.data || [];
    },
    enabled: allowed && tab === "templates" && !!businessId,
  });

  const templateVarsQuery = useQuery({
    queryKey: crmKeys.templateVariables(businessId),
    queryFn: async () => {
      const res = await api<{
        data: {
          variables: TemplateVariable[];
          sample_values: Record<string, string>;
        };
      }>("/crm/templates/variables");
      return {
        variables: res.data?.variables || [],
        sample_values: res.data?.sample_values || { name: "Ayesha", points: "120" },
      };
    },
    enabled: allowed && (tab === "templates" || tplModal) && !!businessId,
  });

  const campaigns: Campaign[] = campaignsQuery.data ?? [];
  const templates: MsgTemplate[] = templatesQuery.data ?? [];
  const templateVars: TemplateVariable[] = templateVarsQuery.data?.variables ?? [];
  const sampleValues: Record<string, string> = templateVarsQuery.data?.sample_values ?? {
    name: "Ayesha",
    points: "120",
  };

  useEffect(() => {
    const err = campaignsQuery.error || templatesQuery.error || templateVarsQuery.error;
    if (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } else {
      setError(null);
    }
  }, [campaignsQuery.error, templatesQuery.error, templateVarsQuery.error]);

  const invalidateCampaigns = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.campaigns(businessId) });
  const invalidateTemplates = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.templates(businessId) });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      await api("/crm/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          title: form.title,
          message: form.message,
          audience: form.audience,
          min_points:
            form.audience === "min_points" && form.min_points
              ? Number(form.min_points)
              : null,
        }),
      });
    },
    onSuccess: async () => {
      setForm({ name: "", title: "", message: "", audience: "all", min_points: "" });
      toast.success(t("marketing.drafted"));
      await invalidateCampaigns();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      await api("/crm/templates", {
        method: "POST",
        body: JSON.stringify({
          ...tplForm,
          variables: sampleValues,
        }),
      });
    },
    onSuccess: async () => {
      setTplForm(emptyTplForm);
      setTplModal(false);
      toast.success(t("marketing.templateSaved"));
      await invalidateTemplates();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async (c: Campaign) => {
      const res = await api<{ data: Campaign }>(`/crm/campaigns/${c.id}/send`, {
        method: "POST",
        body: "{}",
      });
      return res.data;
    },
    onSuccess: async (data) => {
      setDetail(data);
      toast.success(t("marketing.sentOk"));
      await invalidateCampaigns();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const payAndSendMutation = useMutation({
    mutationFn: async (c: Campaign) => {
      const res = await api<{
        data: {
          checkout_url: string;
          payment_id: string;
          dev_fallback?: boolean;
        };
      }>(`/crm/campaigns/${c.id}/checkout`, {
        method: "POST",
        body: "{}",
      });
      if (res.data.dev_fallback) {
        const sent = await api<{ data: Campaign }>(
          `/crm/campaigns/${c.id}/confirm-payment`,
          {
            method: "POST",
            body: JSON.stringify({ payment_id: res.data.payment_id }),
          }
        );
        return { kind: "sent" as const, campaign: sent.data };
      }
      if (res.data.checkout_url) {
        return { kind: "checkout" as const, url: res.data.checkout_url };
      }
      return { kind: "noop" as const };
    },
    onSuccess: async (result) => {
      if (result.kind === "sent") {
        setDetail(result.campaign);
        toast.success(t("marketing.payAndSendDone"));
        await invalidateCampaigns();
      } else if (result.kind === "checkout") {
        await Linking.openURL(result.url);
        toast.success(t("marketing.checkoutOpened"));
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const busy =
    createCampaignMutation.isPending ||
    createTemplateMutation.isPending ||
    sendCampaignMutation.isPending ||
    payAndSendMutation.isPending;

  function isPaidChannel(channel?: string | null) {
    return channel === "sms" || channel === "whatsapp";
  }

  function send(c: Campaign) {
    if (isPaidChannel(c.channel)) {
      Alert.alert(t("marketing.payAndSend"), t("marketing.payAndSendConfirm", { name: c.name }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("marketing.payAndSend"),
          onPress: () => payAndSendMutation.mutate(c),
        },
      ]);
      return;
    }

    Alert.alert(t("marketing.send"), t("marketing.sendConfirm", { name: c.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("marketing.send"),
        onPress: () => sendCampaignMutation.mutate(c),
      },
    ]);
  }

  const tabs = [
    { id: "campaigns" as const, label: t("marketing.tabCampaigns") },
    { id: "templates" as const, label: t("marketing.tabTemplates") },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>{t("pages.marketingTitle")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SegmentedTabs tabs={tabs} value={tab} onChange={(id) => setTab(id as Tab)} />

      {tab === "campaigns" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("marketing.newCampaign")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("marketing.internalName")}
              placeholderTextColor={colors.muted}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            <TextInput
              style={styles.input}
              placeholder={t("marketing.notificationTitle")}
              placeholderTextColor={colors.muted}
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
            />
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              placeholder={t("marketing.message")}
              placeholderTextColor={colors.muted}
              multiline
              value={form.message}
              onChangeText={(v) => setForm({ ...form, message: v })}
            />
            <Pressable
              style={[styles.btn, { backgroundColor: palette.brand }, busy && { opacity: 0.6 }]}
              onPress={() => createCampaignMutation.mutate()}
              disabled={busy}
            >
              <Text style={[styles.btnText, { color: palette.brandForeground }]}>
                {t("marketing.saveDraft")}
              </Text>
            </Pressable>
          </View>

          {campaigns.map((c) => (
            <Pressable key={c.id} style={styles.card} onPress={() => setDetail(c)}>
              <Text style={styles.cardTitle}>{c.name}</Text>
              <Text style={styles.meta}>
                {c.status} · {c.channel || "email"} · {c.audience}
              </Text>
              {c.status === "Draft" ? (
                <Pressable
                  style={[styles.btnSecondary, { borderColor: palette.brand }]}
                  onPress={() => send(c)}
                >
                  <Text style={{ color: palette.brand, fontWeight: "700" }}>
                    {isPaidChannel(c.channel) ? t("marketing.payAndSend") : t("marketing.send")}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}

          {detail ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{detail.name}</Text>
              <Text style={styles.meta}>{detail.title}</Text>
              <Text style={styles.body}>{detail.message}</Text>
              <Pressable onPress={() => setDetail(null)}>
                <Text style={{ color: palette.brand, fontWeight: "700", marginTop: 8 }}>
                  {t("common.close")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {tab === "templates" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("marketing.variablesTitle")}</Text>
            <Text style={styles.body}>{t("marketing.variablesHint")}</Text>
            {templateVars.map((v) => (
              <View key={v.key} style={styles.varRow}>
                <Text style={styles.varCode}>{v.placeholder}</Text>
                <Text style={styles.meta}>
                  {t(`marketing.var.${v.key}` as "marketing.var.business")}
                  {v.example ? ` · ${v.example}` : ""}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.btn, { backgroundColor: palette.brand }]}
            onPress={() => {
              setTplForm(emptyTplForm);
              setTplModal(true);
            }}
          >
            <Text style={[styles.btnText, { color: palette.brandForeground }]}>
              {t("marketing.newTemplate")}
            </Text>
          </Pressable>

          {templates.length === 0 ? (
            <Text style={styles.meta}>{t("marketing.templatesEmptyBody")}</Text>
          ) : (
            templates.map((tpl) => (
              <Pressable
                key={tpl.id}
                style={styles.card}
                onPress={() =>
                  pushPath(navigation, `/app/marketing/templates/${tpl.id}`)
                }
              >
                <Text style={styles.cardTitle}>{tpl.name}</Text>
                <Text style={styles.meta}>{tpl.channel}</Text>
                <Text style={styles.body}>{tpl.title_template}</Text>
              </Pressable>
            ))
          )}
        </>
      ) : null}

      <FormModal
        visible={tplModal}
        title={t("marketing.newTemplate")}
        subtitle={t("marketing.variablesHint")}
        onClose={() => setTplModal(false)}
        onSubmit={() => createTemplateMutation.mutate()}
        submitLabel={t("marketing.saveTemplate")}
        busy={busy}
      >
        <TextInput
          style={styles.input}
          placeholder={t("common.name")}
          placeholderTextColor={colors.muted}
          value={tplForm.name}
          onChangeText={(v) => setTplForm({ ...tplForm, name: v })}
        />
        <TextInput
          style={styles.input}
          placeholder={t("marketing.channel")}
          placeholderTextColor={colors.muted}
          value={tplForm.channel}
          onChangeText={(v) => setTplForm({ ...tplForm, channel: v })}
        />
        <TextInput
          style={styles.input}
          placeholder={t("marketing.titleTemplate")}
          placeholderTextColor={colors.muted}
          value={tplForm.title_template}
          onChangeText={(v) => setTplForm({ ...tplForm, title_template: v })}
        />
        <TextInput
          style={[styles.input, { minHeight: 90 }]}
          placeholder={t("marketing.bodyTemplate")}
          placeholderTextColor={colors.muted}
          multiline
          value={tplForm.body_template}
          onChangeText={(v) => setTplForm({ ...tplForm, body_template: v })}
        />
        <View style={styles.varChips}>
          {templateVars.map((v) => (
            <Pressable
              key={v.key}
              style={styles.chip}
              onPress={() =>
                setTplForm((f) => ({
                  ...f,
                  body_template: `${f.body_template}${f.body_template ? " " : ""}${v.placeholder}`,
                }))
              }
            >
              <Text style={styles.varCode}>{v.placeholder}</Text>
            </Pressable>
          ))}
        </View>
      </FormModal>
    </ScrollView>
  );
}

function createStyles(palette: { brand: string }) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
    title: { fontSize: 22, fontWeight: "800", color: colors.heading, marginBottom: 12 },
    error: { color: colors.danger, marginBottom: 8 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginTop: 12,
      gap: 8,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.heading },
    meta: { fontSize: 13, color: colors.muted },
    body: { fontSize: 14, color: colors.body, lineHeight: 20 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.heading,
      backgroundColor: colors.bg,
      marginTop: 6,
    },
    btn: {
      marginTop: 10,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    btnSecondary: {
      marginTop: 8,
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 10,
      alignItems: "center",
    },
    btnText: { fontWeight: "700" },
    varRow: { marginTop: 8 },
    varCode: { fontFamily: "Courier", fontWeight: "700", color: colors.heading },
    varChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: colors.bg,
    },
  });
}
