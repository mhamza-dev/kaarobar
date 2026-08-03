"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import Select from "@/components/ui/Select";
import { Field, PageHeader, SurfaceCard, TabBar, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useTabQueryParam } from "@/lib/hooks/useTabQueryParam";
import { crmKeys } from "@/lib/queryClient";
import { detailRoutes, routes } from "@/lib/navigation";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";

type Campaign = {
  id: string;
  name: string;
  title: string;
  message: string;
  audience: string;
  channel?: string;
  min_points?: number | null;
  segment_id?: string | null;
  coupon_id?: string | null;
  template_id?: string | null;
  budget_amount?: string | null;
  estimated_cost?: string | null;
  actual_cost?: string | null;
  status: string;
  sent_at?: string | null;
  recipient_count?: number;
  delivery?: {
    notified: number;
    email_only: number;
    skipped: number;
    total: number;
    sms_queued?: number;
    whatsapp_queued?: number;
  };
  recipients?: {
    id: string;
    customer_name?: string;
    channel_status: string;
    delivered_at?: string | null;
  }[];
};

type MsgTemplate = {
  id: string;
  name: string;
  channel: string;
  title_template: string;
  body_template: string;
  variables: Record<string, string>;
};

type Segment = { id: string; name: string; filters: Record<string, unknown> };
type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: string;
  usage_limit?: number | null;
  usage_count: number;
  min_cart?: string | null;
  stackable: boolean;
  active: boolean;
  campaign_id?: string | null;
};
type Tier = {
  id: string;
  name: string;
  min_points: number;
  earn_rate: string;
  redeem_rate: string;
};

const emptyForm = {
  name: "",
  title: "",
  message: "",
  audience: "all",
  channel: "email",
  min_points: "",
  segment_id: "",
  coupon_id: "",
  template_id: "",
  budget_amount: "",
};

type Tab = "campaigns" | "templates" | "segments" | "coupons" | "tiers";

const MARKETING_TABS: readonly Tab[] = [
  "campaigns",
  "templates",
  "segments",
  "coupons",
  "tiers",
];

type TemplateVariable = {
  key: string;
  placeholder: string;
  source: string;
  example: string;
};

const emptyTplForm = {
  name: "",
  channel: "email",
  title_template: "",
  body_template: "",
};

function MarketingPageInner() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const businessId = getSession()?.business_id ?? null;
  const [tab, setTab] = useTabQueryParam<Tab>("campaigns", MARKETING_TABS, {
    basePath: routes.marketing,
  });
  const [campaignFilters, setCampaignFilters] = useState<StaffListFilterState>(
    emptyStaffListFilters()
  );
  const [modal, setModal] = useState(false);
  const [tplModal, setTplModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [costPreview, setCostPreview] = useState<{
    estimated_cost: string;
    unit_cost: string;
  } | null>(null);
  const [tplForm, setTplForm] = useState(emptyTplForm);
  const [tplPreview, setTplPreview] = useState<{ title: string; message: string } | null>(null);
  const [segForm, setSegForm] = useState({ name: "", min_points: "", khata: false });
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_type: "percent",
    discount_value: "",
    usage_limit: "",
    min_cart: "",
    stackable: false,
  });
  const [tierForm, setTierForm] = useState({
    name: "",
    min_points: "0",
    earn_rate: "1",
    redeem_rate: "1",
  });

  const campaignsQuery = useQuery({
    queryKey: crmKeys.campaigns(businessId),
    queryFn: async () => {
      const res = await api<{ data: Campaign[] }>("/crm/campaigns");
      return res.data || [];
    },
    enabled: tab === "campaigns" && !!businessId,
  });

  const templatesQuery = useQuery({
    queryKey: crmKeys.templates(businessId),
    queryFn: async () => {
      const res = await api<{ data: MsgTemplate[] }>("/crm/templates");
      return res.data || [];
    },
    enabled: (tab === "templates" || modal) && !!businessId,
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
    enabled: (tab === "templates" || tplModal) && !!businessId,
  });

  const segmentsQuery = useQuery({
    queryKey: crmKeys.segments(businessId),
    queryFn: async () => {
      const res = await api<{ data: Segment[] }>("/crm/segments");
      return res.data || [];
    },
    enabled: (tab === "segments" || modal) && !!businessId,
  });

  const couponsQuery = useQuery({
    queryKey: crmKeys.coupons(businessId),
    queryFn: async () => {
      const res = await api<{ data: Coupon[] }>("/crm/coupons");
      return res.data || [];
    },
    enabled: (tab === "coupons" || modal) && !!businessId,
  });

  const tiersQuery = useQuery({
    queryKey: crmKeys.tiers(businessId),
    queryFn: async () => {
      const res = await api<{ data: Tier[] }>("/crm/loyalty-tiers");
      return res.data || [];
    },
    enabled: tab === "tiers" && !!businessId,
  });

  const campaigns = campaignsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const templateVars = templateVarsQuery.data?.variables ?? [];
  const sampleValues = templateVarsQuery.data?.sample_values ?? {
    name: "Ayesha",
    points: "120",
  };
  const segments = segmentsQuery.data ?? [];
  const coupons = couponsQuery.data ?? [];
  const tiers = tiersQuery.data ?? [];

  useEffect(() => {
    const err =
      campaignsQuery.error ||
      templatesQuery.error ||
      templateVarsQuery.error ||
      segmentsQuery.error ||
      couponsQuery.error ||
      tiersQuery.error;
    if (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [
    campaignsQuery.error,
    templatesQuery.error,
    templateVarsQuery.error,
    segmentsQuery.error,
    couponsQuery.error,
    tiersQuery.error,
    t,
    toast,
  ]);

  function isPaidChannel(channel?: string | null) {
    return channel === "sms" || channel === "whatsapp";
  }

  const invalidateCampaigns = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.campaigns(businessId) });
  const invalidateTemplates = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.templates(businessId) });
  const invalidateSegments = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.segments(businessId) });
  const invalidateCoupons = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.coupons(businessId) });
  const invalidateTiers = () =>
    queryClient.invalidateQueries({ queryKey: crmKeys.tiers(businessId) });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      await api("/crm/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          title: form.title,
          message: form.message,
          audience: form.audience,
          channel: form.channel,
          template_id: form.template_id || null,
          budget_amount: form.budget_amount || null,
          min_points:
            form.audience === "min_points" && form.min_points
              ? Number(form.min_points)
              : null,
          segment_id: form.audience === "segment" ? form.segment_id || null : null,
          coupon_id: form.coupon_id || null,
        }),
      });
    },
    onSuccess: async () => {
      toast.success(t("marketing.drafted"));
      setModal(false);
      setForm(emptyForm);
      setPreviewCount(null);
      setCostPreview(null);
      await invalidateCampaigns();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
      setTplPreview(null);
      setTplModal(false);
      await invalidateTemplates();
      toast.success(t("marketing.templateSaved"));
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
      const d = data.delivery;
      toast.success(
        d
          ? t("marketing.sentSummary", {
              notified: d.notified,
              email: d.email_only,
              skipped: d.skipped,
            })
          : t("marketing.sentOk")
      );
      setDetail(data);
      await invalidateCampaigns();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const payAndSendMutation = useMutation({
    mutationFn: async (c: Campaign) => {
      const res = await api<{
        data: {
          checkout_url: string;
          payment_id: string;
          amount?: string;
          dev_fallback?: boolean;
        };
      }>(`/crm/campaigns/${c.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({ redirect_url: window.location.href }),
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
        toast.success(t("marketing.payAndSendDone"));
        setDetail(result.campaign);
        await invalidateCampaigns();
      } else if (result.kind === "checkout") {
        window.open(result.url, "_blank", "noopener,noreferrer");
        toast.success(t("marketing.checkoutOpened"));
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const createSegmentMutation = useMutation({
    mutationFn: async () => {
      const filters: Record<string, unknown> = {};
      if (segForm.khata) filters.khata_enabled = true;
      if (segForm.min_points) filters.min_points = Number(segForm.min_points);
      await api("/crm/segments", {
        method: "POST",
        body: JSON.stringify({ name: segForm.name, filters }),
      });
    },
    onSuccess: async () => {
      setSegForm({ name: "", min_points: "", khata: false });
      await invalidateSegments();
      toast.success("Segment created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: async () => {
      await api("/crm/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: couponForm.code,
          discount_type: couponForm.discount_type,
          discount_value: couponForm.discount_value,
          usage_limit: couponForm.usage_limit ? Number(couponForm.usage_limit) : null,
          min_cart: couponForm.min_cart || null,
          stackable: couponForm.stackable,
        }),
      });
    },
    onSuccess: async () => {
      setCouponForm({
        code: "",
        discount_type: "percent",
        discount_value: "",
        usage_limit: "",
        min_cart: "",
        stackable: false,
      });
      await invalidateCoupons();
      toast.success("Coupon created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const createTierMutation = useMutation({
    mutationFn: async () => {
      await api("/crm/loyalty-tiers", {
        method: "POST",
        body: JSON.stringify({
          name: tierForm.name,
          min_points: Number(tierForm.min_points),
          earn_rate: tierForm.earn_rate,
          redeem_rate: tierForm.redeem_rate,
        }),
      });
    },
    onSuccess: async () => {
      setTierForm({ name: "", min_points: "0", earn_rate: "1", redeem_rate: "1" });
      await invalidateTiers();
      toast.success("Tier created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const busy =
    createCampaignMutation.isPending ||
    createTemplateMutation.isPending ||
    sendCampaignMutation.isPending ||
    payAndSendMutation.isPending ||
    createSegmentMutation.isPending ||
    createCouponMutation.isPending ||
    createTierMutation.isPending;

  async function previewAudience() {
    try {
      const res = await api<{
        data: {
          count: number;
          estimated_cost: string;
          unit_cost: string;
          wallet_balance: string;
          can_send: boolean;
        };
      }>("/crm/campaigns/preview", {
        method: "POST",
        body: JSON.stringify({
          audience: form.audience,
          channel: form.channel,
          budget_amount: form.budget_amount || null,
          min_points:
            form.audience === "min_points" && form.min_points
              ? Number(form.min_points)
              : null,
          segment_id: form.audience === "segment" ? form.segment_id || null : null,
        }),
      });
      setPreviewCount(res.data.count);
      setCostPreview({
        estimated_cost: res.data.estimated_cost,
        unit_cost: res.data.unit_cost,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    createCampaignMutation.mutate();
  }

  function applyTemplate(id: string) {
    const tpl = templates.find((x) => x.id === id);
    setForm((f) => {
      if (!tpl) return { ...f, template_id: id };
      const vars = tpl.variables || {};
      let title = tpl.title_template;
      let message = tpl.body_template;
      Object.entries(vars).forEach(([k, v]) => {
        title = title.replaceAll(`{{${k}}}`, String(v));
        message = message.replaceAll(`{{${k}}}`, String(v));
      });
      return {
        ...f,
        template_id: id,
        channel: tpl.channel,
        title,
        message,
      };
    });
  }

  function openTplModal() {
    setTplForm(emptyTplForm);
    setTplPreview(null);
    setTplModal(true);
  }

  function insertTplVar(placeholder: string) {
    setTplForm((f) => ({
      ...f,
      body_template: `${f.body_template}${f.body_template ? " " : ""}${placeholder}`,
    }));
  }

  async function previewTemplate() {
    try {
      const res = await api<{ data: { title: string; message: string } }>(
        "/crm/templates/preview",
        {
          method: "POST",
          body: JSON.stringify({
            channel: tplForm.channel,
            title_template: tplForm.title_template,
            body_template: tplForm.body_template,
            variables: sampleValues,
          }),
        }
      );
      setTplPreview(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    createTemplateMutation.mutate();
  }

  function sendCampaign(c: Campaign) {
    if (!confirm(t("marketing.sendConfirm", { name: c.name }))) return;
    sendCampaignMutation.mutate(c);
  }

  function payAndSendCampaign(c: Campaign) {
    if (!confirm(t("marketing.payAndSendConfirm", { name: c.name }))) return;
    payAndSendMutation.mutate(c);
  }

  function createSegment(e: React.FormEvent) {
    e.preventDefault();
    createSegmentMutation.mutate();
  }

  function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    createCouponMutation.mutate();
  }

  function createTier(e: React.FormEvent) {
    e.preventDefault();
    createTierMutation.mutate();
  }

  const tabs: { id: Tab; label: string; infoKey?: string }[] = [
    { id: "campaigns", label: t("marketing.tabCampaigns"), infoKey: "tab.marketing.campaigns" },
    { id: "templates", label: t("marketing.tabTemplates"), infoKey: "tab.marketing.templates" },
    { id: "segments", label: t("marketing.tabSegments"), infoKey: "tab.marketing.segments" },
    { id: "coupons", label: t("marketing.tabCoupons"), infoKey: "tab.marketing.coupons" },
    { id: "tiers", label: t("marketing.tabTiers"), infoKey: "tab.marketing.tiers" },
  ];

  const campaignFilterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: false,
      statusOptions: [
        { value: "Draft", label: t("marketing.statusDraft") },
        { value: "Sent", label: t("marketing.statusSent") },
      ],
      categoryLabel: t("marketing.channel"),
      categoryOptions: [
        { value: "email", label: "Email" },
        { value: "sms", label: "SMS" },
        { value: "whatsapp", label: "WhatsApp" },
        { value: "push", label: "Push" },
      ],
    }),
    [t]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("marketing.eyebrow")}
        title={t("pages.marketingTitle")}
        description={t("pages.marketingDesc")}
        infoKey="page.marketing"
        action={
          tab === "campaigns"
            ? { label: t("marketing.newCampaign"), onClick: () => setModal(true) }
            : tab === "templates"
              ? { label: t("marketing.newTemplate"), onClick: openTplModal }
            : undefined
        }
        secondaryAction={{
          label: t("nav.customers"),
          onClick: () => {
            window.location.href = "/app/customers";
          },
        }}
      />

      <TabBar
        tabs={tabs}
        value={tab}
        onChange={setTab}
        aria-label="Marketing sections"
      />

      {tab === "campaigns" ? (
        <>
          <p className="text-sm text-body">
            {t("marketing.hint")}{" "}
            <Link href="/app/customers" className="text-brand underline">
              {t("nav.customers")}
            </Link>
            . {t("marketing.payHint")}
          </p>

          <DataTable
            maxHeight="24rem"
            loading={campaignsQuery.isLoading || campaignsQuery.isFetching}
            filterState={campaignFilters}
            onFilterChange={setCampaignFilters}
            filterConfig={campaignFilterConfig}
            filterAccessors={{
              searchText: (c) =>
                `${c.name} ${c.title || ""} ${c.status} ${c.channel || ""}`,
              status: (c) => c.status,
              category: (c) => c.channel || "email",
            }}
            clientFilter
            searchPlaceholder={t("marketing.search")}
            pagination={{ mode: "client", pageSize: 25 }}
            exportable
            exportFilename="campaigns"
            exportTitle="Campaigns"
            getExportRow={(c) => ({
              name: c.name,
              channel: c.channel || "email",
              status: c.status || "",
            })}
            exportColumns={[
              { key: "name", header: "Name" },
              { key: "channel", header: "Channel" },
              { key: "status", header: "Status" },
            ]}
            onRowClick={(c) => router.push(detailRoutes.campaign(c.id))}
            columns={[
              {
                id: "name",
                header: t("common.name"),
                cell: (c) => (
                  <Link
                    href={detailRoutes.campaign(c.id)}
                    className="font-semibold text-brand underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.name}
                  </Link>
                ),
              },
              {
                id: "channel",
                header: "Channel",
                cell: (c) => c.channel || "email",
              },
              {
                id: "audience",
                header: t("marketing.audience"),
                cell: (c) => c.audience,
              },
              {
                id: "status",
                header: t("common.status"),
                cell: (c) =>
                  c.status === "Draft" ? t("marketing.statusDraft") : t("marketing.statusSent"),
              },
              {
                id: "recipients",
                header: t("marketing.recipients"),
                cell: (c) => String(c.recipient_count ?? 0),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                width: 56,
                cell: (c) => (
                  <div className="flex justify-end">
                    <ActionMenu
                      items={[
                        {
                          id: "detail",
                          label: t("marketing.detail"),
                          onClick: () => router.push(detailRoutes.campaign(c.id)),
                        },
                        {
                          id: "send",
                          label: isPaidChannel(c.channel)
                            ? t("marketing.payAndSend")
                            : t("marketing.send"),
                          onClick: () =>
                            void (isPaidChannel(c.channel)
                              ? payAndSendCampaign(c)
                              : sendCampaign(c)),
                          hidden: c.status !== "Draft",
                          disabled: busy,
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
            data={campaigns}
            rowKey={(c) => c.id}
            emptyTitle={t("marketing.emptyTitle")}
            emptyBody={t("marketing.emptyBody")}
          />
        </>
      ) : null}

      {tab === "templates" ? (
        <div className="space-y-4">
          <SurfaceCard className="space-y-3 p-4">
            <h3 className="font-semibold text-heading">{t("marketing.variablesTitle")}</h3>
            <p className="text-sm text-body">{t("marketing.variablesHint")}</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {templateVars.map((v) => (
                <li
                  key={v.key}
                  className="rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm"
                >
                  <code className="font-semibold text-heading">{v.placeholder}</code>
                  <p className="mt-1 text-xs text-muted">
                    {t(`marketing.var.${v.key}` as "marketing.var.business")}
                    {v.example ? ` · ${v.example}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <DataTable
            maxHeight="24rem"
            loading={templatesQuery.isLoading || templatesQuery.isFetching}
            onRowClick={(tpl) => router.push(detailRoutes.template(tpl.id))}
            columns={[
              {
                id: "name",
                header: t("common.name"),
                cell: (tpl) => (
                  <Link
                    href={detailRoutes.template(tpl.id)}
                    className="font-semibold text-brand underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tpl.name}
                  </Link>
                ),
              },
              {
                id: "channel",
                header: t("marketing.channel"),
                cell: (tpl) => tpl.channel,
              },
              {
                id: "title",
                header: t("marketing.titleTemplate"),
                cell: (tpl) => (
                  <span className="line-clamp-1 text-body">{tpl.title_template}</span>
                ),
              },
            ]}
            data={templates}
            rowKey={(tpl) => tpl.id}
            emptyTitle={t("marketing.templatesEmpty")}
            emptyBody={t("marketing.templatesEmptyBody")}
          />
        </div>
      ) : null}

      {tab === "segments" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="space-y-3 p-4">
            <h3 className="font-semibold text-heading">New segment</h3>
            <form onSubmit={createSegment} className="grid gap-3">
              <Field label="Name">
                <input
                  className={fieldClass}
                  required
                  value={segForm.name}
                  onChange={(e) => setSegForm({ ...segForm, name: e.target.value })}
                />
              </Field>
              <Field label="Min points">
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  value={segForm.min_points}
                  onChange={(e) => setSegForm({ ...segForm, min_points: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-body">
                <input
                  type="checkbox"
                  checked={segForm.khata}
                  onChange={(e) => setSegForm({ ...segForm, khata: e.target.checked })}
                />
                Khata customers only
              </label>
              <Button type="submit" loading={busy}>
                Save segment
              </Button>
            </form>
          </SurfaceCard>
          <DataTable
            loading={segmentsQuery.isLoading || segmentsQuery.isFetching}
            columns={[
              { id: "name", header: "Name", cell: (s) => s.name },
              {
                id: "filters",
                header: "Filters",
                cell: (s) => JSON.stringify(s.filters || {}),
              },
            ]}
            data={segments}
            rowKey={(s) => s.id}
            emptyTitle="No segments"
            emptyBody="Create a named audience filter."
          />
        </div>
      ) : null}

      {tab === "coupons" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="space-y-3 p-4">
            <h3 className="font-semibold text-heading">New coupon</h3>
            <form onSubmit={createCoupon} className="grid gap-3">
              <Field label="Code">
                <input
                  className={fieldClass}
                  required
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <Field label="Type">
                <Select
                  value={couponForm.discount_type}
                  onChange={(v) =>
                    setCouponForm({ ...couponForm, discount_type: v })
                  }
                  options={[
                    { value: "percent", label: "Percent" },
                    { value: "fixed", label: "Fixed" },
                  ]}
                />
              </Field>
              <Field label="Value">
                <input
                  className={fieldClass}
                  required
                  value={couponForm.discount_value}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, discount_value: e.target.value })
                  }
                />
              </Field>
              <Field label="Usage limit">
                <input
                  className={fieldClass}
                  value={couponForm.usage_limit}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, usage_limit: e.target.value })
                  }
                />
              </Field>
              <Field label="Min cart">
                <input
                  className={fieldClass}
                  value={couponForm.min_cart}
                  onChange={(e) => setCouponForm({ ...couponForm, min_cart: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-body">
                <input
                  type="checkbox"
                  checked={couponForm.stackable}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, stackable: e.target.checked })
                  }
                />
                Stackable with other discounts
              </label>
              <Button type="submit" loading={busy}>
                Save coupon
              </Button>
            </form>
          </SurfaceCard>
          <DataTable
            loading={couponsQuery.isLoading || couponsQuery.isFetching}
            columns={[
              { id: "code", header: "Code", cell: (c) => c.code },
              {
                id: "value",
                header: "Discount",
                cell: (c) =>
                  c.discount_type === "percent"
                    ? `${c.discount_value}%`
                    : `Rs ${c.discount_value}`,
              },
              {
                id: "usage",
                header: "Usage",
                cell: (c) =>
                  `${c.usage_count}${c.usage_limit != null ? ` / ${c.usage_limit}` : ""}`,
              },
            ]}
            data={coupons}
            rowKey={(c) => c.id}
            emptyTitle="No coupons"
            emptyBody="Create a promo code for POS checkout."
          />
        </div>
      ) : null}

      {tab === "tiers" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="space-y-3 p-4">
            <h3 className="font-semibold text-heading">New loyalty tier</h3>
            <form onSubmit={createTier} className="grid gap-3">
              <Field label="Name">
                <input
                  className={fieldClass}
                  required
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                />
              </Field>
              <Field label="Min points">
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  required
                  value={tierForm.min_points}
                  onChange={(e) => setTierForm({ ...tierForm, min_points: e.target.value })}
                />
              </Field>
              <Field label="Earn rate multiplier">
                <input
                  className={fieldClass}
                  value={tierForm.earn_rate}
                  onChange={(e) => setTierForm({ ...tierForm, earn_rate: e.target.value })}
                />
              </Field>
              <Field label="Redeem rate multiplier">
                <input
                  className={fieldClass}
                  value={tierForm.redeem_rate}
                  onChange={(e) => setTierForm({ ...tierForm, redeem_rate: e.target.value })}
                />
              </Field>
              <Button type="submit" loading={busy}>
                Save tier
              </Button>
            </form>
          </SurfaceCard>
          <DataTable
            loading={tiersQuery.isLoading || tiersQuery.isFetching}
            columns={[
              { id: "name", header: "Name", cell: (t) => t.name },
              { id: "min", header: "Min points", cell: (t) => String(t.min_points) },
              { id: "earn", header: "Earn ×", cell: (t) => t.earn_rate },
              { id: "redeem", header: "Redeem ×", cell: (t) => t.redeem_rate },
            ]}
            data={tiers}
            rowKey={(t) => t.id}
            emptyTitle="No tiers"
            emptyBody="Add named loyalty tiers for customers."
          />
        </div>
      ) : null}

      {detail ? (
        <SurfaceCard className="space-y-3 p-4">
          <div className="flex justify-between gap-2">
            <div>
              <h3 className="font-semibold text-heading">{detail.name}</h3>
              <p className="text-sm text-body">
                {detail.title} · {detail.channel || "email"} · {detail.status}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setDetail(null)}>
              {t("common.close")}
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-heading">{detail.message}</p>
          <ul className="divide-y divide-border text-sm">
            {(detail.recipients || []).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 py-2">
                <span className="text-heading">{r.customer_name || r.id.slice(0, 8)}</span>
                <span className="text-body">{r.channel_status}</span>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={t("marketing.newCampaign")}
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void previewAudience()}>
              Preview audience
              {previewCount != null ? ` (${previewCount})` : ""}
            </Button>
            <Button type="submit" form="campaign-form" loading={busy}>
              {t("marketing.saveDraft")}
            </Button>
          </div>
        }
      >
        <form id="campaign-form" onSubmit={createCampaign} className="grid gap-3">
          <Field label={t("marketing.internalName")}>
            <input
              className={fieldClass}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Template (optional)">
            <Select
              value={form.template_id}
              onChange={(v) => applyTemplate(v)}
              placeholder="None — write freely"
              options={[
                { value: "", label: "None — write freely" },
                ...templates.map((tpl) => ({
                  value: tpl.id,
                  label: `${tpl.name} (${tpl.channel})`,
                })),
              ]}
            />
          </Field>
          <Field label={t("marketing.notificationTitle")}>
            <input
              className={fieldClass}
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label={t("marketing.message")}>
            <textarea
              className={fieldClass}
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </Field>
          <div className="rounded-md border border-border bg-bg-primary p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase text-muted">Message preview</p>
            <p className="font-semibold text-heading">{form.title || "Title"}</p>
            <p className="mt-1 whitespace-pre-wrap text-body">{form.message || "Message body…"}</p>
          </div>
          <Field label="Channel">
            <Select
              value={form.channel}
              onChange={(v) => setForm({ ...form, channel: v })}
              options={[
                { value: "email", label: "Email" },
                { value: "in_app", label: "In-app" },
                { value: "sms", label: "SMS" },
                { value: "whatsapp", label: "WhatsApp" },
              ]}
            />
          </Field>
          <Field label="Budget (PKR)">
            <input
              className={fieldClass}
              type="number"
              min={0}
              step="0.01"
              placeholder={
                form.channel === "sms" || form.channel === "whatsapp"
                  ? "Required for paid channels"
                  : "Optional soft cap"
              }
              value={form.budget_amount}
              onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
            />
          </Field>
          <Field label={t("marketing.audience")}>
            <Select
              value={form.audience}
              onChange={(v) => setForm({ ...form, audience: v })}
              options={[
                { value: "all", label: t("marketing.audienceAll") },
                { value: "khata", label: t("marketing.audienceKhata") },
                { value: "min_points", label: t("marketing.audienceMinPoints") },
                { value: "segment", label: "Named segment" },
              ]}
            />
          </Field>
          {form.audience === "min_points" ? (
            <Field label={t("marketing.minPoints")}>
              <input
                className={fieldClass}
                type="number"
                min={0}
                value={form.min_points}
                onChange={(e) => setForm({ ...form, min_points: e.target.value })}
              />
            </Field>
          ) : null}
          {form.audience === "segment" ? (
            <Field label="Segment">
              <Select
                required
                value={form.segment_id}
                onChange={(v) => setForm({ ...form, segment_id: v })}
                placeholder="Select…"
                options={[
                  { value: "", label: "Select…" },
                  ...segments.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </Field>
          ) : null}
          <Field label="Link coupon (optional)">
            <Select
              value={form.coupon_id}
              onChange={(v) => setForm({ ...form, coupon_id: v })}
              placeholder="None"
              options={[
                { value: "", label: "None" },
                ...coupons.map((c) => ({ value: c.id, label: c.code })),
              ]}
            />
          </Field>
          {costPreview ? (
            <p className="text-sm text-body">
              {t("marketing.estCost", {
                cost: costPreview.estimated_cost,
                unit: costPreview.unit_cost,
              })}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        isOpen={tplModal}
        onClose={() => setTplModal(false)}
        title={t("marketing.newTemplate")}
        description={t("marketing.variablesHint")}
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => void previewTemplate()}>
              {t("marketing.preview")}
            </Button>
            <Button type="submit" form="template-form" loading={busy}>
              {t("marketing.saveTemplate")}
            </Button>
          </div>
        }
      >
        <form id="template-form" onSubmit={createTemplate} className="grid gap-3">
          <Field label={t("common.name")}>
            <input
              className={fieldClass}
              required
              value={tplForm.name}
              onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
            />
          </Field>
          <Field label={t("marketing.channel")}>
            <Select
              value={tplForm.channel}
              onChange={(v) => setTplForm({ ...tplForm, channel: v })}
              options={[
                { value: "email", label: t("marketing.channelEmail") },
                { value: "in_app", label: t("marketing.channelInApp") },
                { value: "sms", label: t("marketing.channelSms") },
                { value: "whatsapp", label: t("marketing.channelWhatsapp") },
              ]}
            />
          </Field>
          <Field label={t("marketing.titleTemplate")}>
            <input
              className={fieldClass}
              required
              value={tplForm.title_template}
              onChange={(e) => setTplForm({ ...tplForm, title_template: e.target.value })}
              placeholder="{{business}} offer for {{name}}"
            />
          </Field>
          <Field label={t("marketing.bodyTemplate")}>
            <textarea
              className={fieldClass}
              required
              rows={4}
              value={tplForm.body_template}
              onChange={(e) => setTplForm({ ...tplForm, body_template: e.target.value })}
              placeholder="Hi {{name}}, … Use {{points}} for loyalty."
            />
          </Field>
          {templateVars.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                {t("marketing.variablesTitle")}
              </p>
              <div className="flex flex-wrap gap-2">
                {templateVars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className="rounded-md border border-border bg-bg-tertiary px-2 py-1 font-mono text-xs text-heading hover:border-brand"
                    onClick={() => insertTplVar(v.placeholder)}
                  >
                    {v.placeholder}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {tplPreview ? (
            <div className="rounded-md border border-border bg-white p-3 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase text-muted">
                {t("marketing.preview")} ({tplForm.channel})
              </p>
              <p className="mt-2 font-bold text-heading">{tplPreview.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-body">{tplPreview.message}</p>
              {tplForm.channel === "sms" ? (
                <p className="mt-2 text-xs text-muted">
                  {t("marketing.charsCount", { count: tplPreview.message.length })}
                </p>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-body">Loading…</p>}>
      <MarketingPageInner />
    </Suspense>
  );
}
