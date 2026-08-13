import { useEffect, useMemo, useState } from "react";
import { type Theme, useTheme } from "@/theme";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { useField } from "formik";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession } from "@/lib/api";
import { canAccessRoute, isPlanFeatureLocked } from "@/lib/rbac";
import { t } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { replacePath, pushPath } from "@/lib/nav";
import ScreenTabs from "@/components/screen/screen-tabs";
import EntityFormModal from "@/components/screen/entity-form-modal";
import ScreenCard from "@/components/screen/screen-card";
import CustomForm from "@/components/form/custom-form";
import { FormikTextField } from "@/components/form/form-fields";
import { useTabParam } from "@/hooks/useTabParam";
import { crmKeys } from "@/lib/queryClient";
import {
  campaignFormSchema,
  emptyCampaignForm,
  emptyTemplateForm,
  templateFormSchema,
  type CampaignFormValues,
  type TemplateFormValues,
} from "@/lib/validations/marketing";

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

function InsertVarChips({
  vars,
  styles,
}: {
  vars: TemplateVariable[];
  styles: ReturnType<typeof createStyles>;
}) {
  const [field, , helpers] = useField<string>("body_template");
  return (
    <View style={styles.varChips}>
      {vars.map((v) => (
        <Pressable
          key={v.key}
          style={styles.chip}
          onPress={() =>
            void helpers.setValue(
              `${field.value || ""}${field.value ? " " : ""}${v.placeholder}`
            )
          }
        >
          <Text style={styles.varCode}>{v.placeholder}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function MarketingScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useTabParam<Tab>("campaigns", MARKETING_TABS);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [campaignInitial, setCampaignInitial] = useState(emptyCampaignForm());
  const [tplInitial, setTplInitial] = useState(emptyTemplateForm());
  const [tplModal, setTplModal] = useState(false);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        replacePath("/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/marketing")) {
        if (isPlanFeatureLocked(s, "/app/marketing")) {
          toast.error(t("rbac.planFeatureLocked"));
        }
        replacePath("/app/dashboard");
        return;
      }
      setBusinessId(s.business_id ?? null);
      setAllowed(true);
    })();
  }, [toast]);

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

  // Query failures are derived, not mirrored into state. `error` stays for
  // mutation failures, which a background refetch should no longer wipe out.
  const queryError =
    campaignsQuery.error || templatesQuery.error || templateVarsQuery.error;
  const displayError =
    error ??
    (queryError
      ? queryError instanceof Error
        ? queryError.message
        : t("common.loadFailed")
      : null);

  const invalidateCampaigns = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.campaigns(businessId) });
  const invalidateTemplates = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.templates(businessId) });

  const createCampaignMutation = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      await api("/crm/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          title: values.title,
          message: values.message,
          audience: values.audience,
          min_points:
            values.audience === "min_points" && values.min_points
              ? Number(values.min_points)
              : null,
        }),
      });
    },
    onSuccess: async () => {
      setCampaignInitial(emptyCampaignForm());
      toast.success(t("marketing.drafted"));
      await invalidateCampaigns();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (values: TemplateFormValues) => {
      await api("/crm/templates", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          variables: sampleValues,
        }),
      });
    },
    onSuccess: async () => {
      setTplInitial(emptyTemplateForm());
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
      {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

      <ScreenTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "campaigns" ? (
        <>
          <ScreenCard
            title={t("marketing.newCampaign")}
            style={styles.card}
            titleStyle={styles.cardTitle}
          >
            <CustomForm
              initialValues={campaignInitial}
              validationSchema={campaignFormSchema}
              enableReinitialize
              onSubmit={async (values) => {
                await createCampaignMutation.mutateAsync(values);
              }}
            >
              {({ handleSubmit }) => (
                <>
                  <FormikTextField
                    name="name"
                    style={styles.input}
                    placeholder={t("marketing.internalName")}
                  />
                  <FormikTextField
                    name="title"
                    style={styles.input}
                    placeholder={t("marketing.notificationTitle")}
                  />
                  <FormikTextField
                    name="message"
                    style={[styles.input, { minHeight: 80 }]}
                    placeholder={t("marketing.message")}
                    multiline
                  />
                  <Pressable
                    style={[
                      styles.btn,
                      { backgroundColor: theme.brand },
                      busy && { opacity: 0.6 },
                    ]}
                    onPress={() => handleSubmit()}
                    disabled={busy}
                  >
                    <Text style={[styles.btnText, { color: theme.brandForeground }]}>
                      {t("marketing.saveDraft")}
                    </Text>
                  </Pressable>
                </>
              )}
            </CustomForm>
          </ScreenCard>

          {campaigns.map((c) => (
            <Pressable key={c.id} style={styles.card} onPress={() => setDetail(c)}>
              <Text style={styles.cardTitle}>{c.name}</Text>
              <Text style={styles.meta}>
                {c.status} · {c.channel || "email"} · {c.audience}
              </Text>
              {c.status === "Draft" ? (
                <Pressable
                  style={[styles.btnSecondary, { borderColor: theme.brand }]}
                  onPress={() => send(c)}
                >
                  <Text style={{ color: theme.brand, fontWeight: "700" }}>
                    {isPaidChannel(c.channel) ? t("marketing.payAndSend") : t("marketing.send")}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}

          {detail ? (
            <ScreenCard title={detail.name} style={styles.card} titleStyle={styles.cardTitle}>
              <Text style={styles.meta}>{detail.title}</Text>
              <Text style={styles.body}>{detail.message}</Text>
              <Pressable onPress={() => setDetail(null)}>
                <Text style={{ color: theme.brand, fontWeight: "700", marginTop: 8 }}>
                  {t("common.close")}
                </Text>
              </Pressable>
            </ScreenCard>
          ) : null}
        </>
      ) : null}

      {tab === "templates" ? (
        <>
          <ScreenCard
            title={t("marketing.variablesTitle")}
            style={styles.card}
            titleStyle={styles.cardTitle}
          >
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
          </ScreenCard>

          <Pressable
            style={[styles.btn, { backgroundColor: theme.brand }]}
            onPress={() => {
              setTplInitial(emptyTemplateForm());
              setTplModal(true);
            }}
          >
            <Text style={[styles.btnText, { color: theme.brandForeground }]}>
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
                  pushPath(`/app/marketing/templates/${tpl.id}`)
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

      <EntityFormModal
        visible={tplModal}
        title={t("marketing.newTemplate")}
        subtitle={t("marketing.variablesHint")}
        onClose={() => setTplModal(false)}
        submitLabel={t("marketing.saveTemplate")}
        busy={busy}
        initialValues={tplInitial}
        validationSchema={templateFormSchema}
        enableReinitialize
        onSubmit={async (values) => {
          await createTemplateMutation.mutateAsync(values);
        }}
      >
        {() => (
          <>
            <FormikTextField
              name="name"
              style={styles.input}
              placeholder={t("common.name")}
            />
            <FormikTextField
              name="channel"
              style={styles.input}
              placeholder={t("marketing.channel")}
            />
            <FormikTextField
              name="title_template"
              style={styles.input}
              placeholder={t("marketing.titleTemplate")}
            />
            <FormikTextField
              name="body_template"
              style={[styles.input, { minHeight: 90 }]}
              placeholder={t("marketing.bodyTemplate")}
              multiline
            />
            <InsertVarChips vars={templateVars} styles={styles} />
          </>
        )}
      </EntityFormModal>
    </ScrollView>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary, padding: 16 },
    title: { fontSize: 22, fontWeight: "800", color: t.heading, marginBottom: 12 },
    error: { color: t.danger, marginBottom: 8 },
    card: {
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginTop: 12,
      gap: 8,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: t.heading },
    meta: { fontSize: 13, color: t.muted },
    body: { fontSize: 14, color: t.body, lineHeight: 20 },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.heading,
      backgroundColor: t.bgPrimary,
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
    varCode: { fontFamily: "Courier", fontWeight: "700", color: t.heading },
    varChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    chip: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: t.bgPrimary,
    },
  });
}
