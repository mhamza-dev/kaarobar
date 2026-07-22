"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import { Field, PageHeader, SurfaceCard, TabBar, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";

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
};

type Tab = "campaigns" | "segments" | "coupons" | "tiers";

export default function MarketingPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
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

  const load = useCallback(async () => {
    try {
      const [c, s, co, ti] = await Promise.all([
        api<{ data: Campaign[] }>("/crm/campaigns"),
        api<{ data: Segment[] }>("/crm/segments"),
        api<{ data: Coupon[] }>("/crm/coupons"),
        api<{ data: Tier[] }>("/crm/loyalty-tiers"),
      ]);
      setCampaigns(c.data || []);
      setSegments(s.data || []);
      setCoupons(co.data || []);
      setTiers(ti.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function previewAudience() {
    try {
      const res = await api<{ data: { count: number } }>("/crm/campaigns/preview", {
        method: "POST",
        body: JSON.stringify({
          audience: form.audience,
          channel: form.channel,
          min_points:
            form.audience === "min_points" && form.min_points
              ? Number(form.min_points)
              : null,
          segment_id: form.audience === "segment" ? form.segment_id || null : null,
        }),
      });
      setPreviewCount(res.data.count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/crm/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          title: form.title,
          message: form.message,
          audience: form.audience,
          channel: form.channel,
          min_points:
            form.audience === "min_points" && form.min_points
              ? Number(form.min_points)
              : null,
          segment_id: form.audience === "segment" ? form.segment_id || null : null,
          coupon_id: form.coupon_id || null,
        }),
      });
      toast.success(t("marketing.drafted"));
      setModal(false);
      setForm(emptyForm);
      setPreviewCount(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function sendCampaign(c: Campaign) {
    if (!confirm(t("marketing.sendConfirm", { name: c.name }))) return;
    setBusy(true);
    try {
      const res = await api<{ data: Campaign }>(`/crm/campaigns/${c.id}/send`, {
        method: "POST",
        body: "{}",
      });
      const d = res.data.delivery;
      toast.success(
        d
          ? t("marketing.sentSummary", {
              notified: d.notified,
              email: d.email_only,
              skipped: d.skipped,
            })
          : t("marketing.sentOk")
      );
      await load();
      setDetail(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function createSegment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const filters: Record<string, unknown> = {};
      if (segForm.khata) filters.khata_enabled = true;
      if (segForm.min_points) filters.min_points = Number(segForm.min_points);
      await api("/crm/segments", {
        method: "POST",
        body: JSON.stringify({ name: segForm.name, filters }),
      });
      setSegForm({ name: "", min_points: "", khata: false });
      await load();
      toast.success("Segment created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
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
      setCouponForm({
        code: "",
        discount_type: "percent",
        discount_value: "",
        usage_limit: "",
        min_cart: "",
        stackable: false,
      });
      await load();
      toast.success("Coupon created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function createTier(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/crm/loyalty-tiers", {
        method: "POST",
        body: JSON.stringify({
          name: tierForm.name,
          min_points: Number(tierForm.min_points),
          earn_rate: tierForm.earn_rate,
          redeem_rate: tierForm.redeem_rate,
        }),
      });
      setTierForm({ name: "", min_points: "0", earn_rate: "1", redeem_rate: "1" });
      await load();
      toast.success("Tier created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string; infoKey?: string }[] = [
    { id: "campaigns", label: "Campaigns", infoKey: "tab.marketing.campaigns" },
    { id: "segments", label: "Segments", infoKey: "tab.marketing.segments" },
    { id: "coupons", label: "Coupons", infoKey: "tab.marketing.coupons" },
    { id: "tiers", label: "Loyalty tiers", infoKey: "tab.marketing.tiers" },
  ];

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
            . Opt-in consent is required for email/SMS/WhatsApp sends.
          </p>

          <DataTable
            maxHeight="24rem"
            searchable
            searchPlaceholder={t("marketing.search")}
            getSearchText={(c) => `${c.name} ${c.title} ${c.status} ${c.channel || ""}`}
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
                          label: t("marketing.send"),
                          onClick: () => void sendCampaign(c),
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
                <select
                  className={fieldClass}
                  value={couponForm.discount_type}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, discount_type: e.target.value })
                  }
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
                </select>
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
          <Field label="Channel">
            <select
              className={fieldClass}
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="email">Email</option>
              <option value="in_app">In-app</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
          <Field label={t("marketing.audience")}>
            <select
              className={fieldClass}
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="all">{t("marketing.audienceAll")}</option>
              <option value="khata">{t("marketing.audienceKhata")}</option>
              <option value="min_points">{t("marketing.audienceMinPoints")}</option>
              <option value="segment">Named segment</option>
            </select>
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
              <select
                className={fieldClass}
                required
                value={form.segment_id}
                onChange={(e) => setForm({ ...form, segment_id: e.target.value })}
              >
                <option value="">Select…</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Link coupon (optional)">
            <select
              className={fieldClass}
              value={form.coupon_id}
              onChange={(e) => setForm({ ...form, coupon_id: e.target.value })}
            >
              <option value="">None</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
