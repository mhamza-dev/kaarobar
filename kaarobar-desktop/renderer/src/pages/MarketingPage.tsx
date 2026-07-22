
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import { Field, PageHeader, SurfaceCard, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

type Campaign = {
  id: string;
  name: string;
  title: string;
  message: string;
  audience: string;
  min_points?: number | null;
  status: string;
  sent_at?: string | null;
  recipient_count?: number;
  delivery?: { notified: number; email_only: number; skipped: number; total: number };
  recipients?: {
    id: string;
    customer_name?: string;
    channel_status: string;
    delivered_at?: string | null;
  }[];
};

const emptyForm = {
  name: "",
  title: "",
  message: "",
  audience: "all",
  min_points: "",
};

export default function MarketingPage() {
  const t = useT();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Campaign[] }>("/crm/campaigns");
      setCampaigns(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
          min_points:
            form.audience === "min_points" && form.min_points
              ? Number(form.min_points)
              : null,
        }),
      });
      toast.success(t("marketing.drafted"));
      setModal(false);
      setForm(emptyForm);
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

  async function openDetail(c: Campaign) {
    try {
      const res = await api<{ data: Campaign }>(`/crm/campaigns/${c.id}`);
      setDetail(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  function audienceLabel(audience: string) {
    if (audience === "khata") return t("marketing.audienceKhata");
    if (audience === "min_points") return t("marketing.audienceMinPoints");
    return t("marketing.audienceAll");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("marketing.eyebrow")}
        title={t("pages.marketingTitle")}
        description={t("pages.marketingDesc")}
        infoKey="page.marketing"
        action={{ label: t("marketing.newCampaign"), onClick: () => setModal(true) }}
        secondaryAction={{
          label: t("nav.customers"),
          onClick: () => {
            window.location.hash = "#/app/customers";
          },
        }}
      />

      <p className="text-sm text-body">
        {t("marketing.hint")}{" "}
        <Link to="/app/customers" className="text-brand underline">
          {t("nav.customers")}
        </Link>
        .
      </p>

      <DataTable
        maxHeight="24rem"
        searchable
        searchPlaceholder={t("marketing.search")}
        getSearchText={(c) => `${c.name} ${c.title} ${c.status}`}
        columns={[
          { id: "name", header: t("common.name"), cell: (c) => c.name },
          {
            id: "audience",
            header: t("marketing.audience"),
            cell: (c) => audienceLabel(c.audience),
          },
          {
            id: "status",
            header: t("common.status"),
            cell: (c) =>
              c.status === "Draft" ? t("marketing.statusDraft") : t("marketing.statusSent"),
          },
          {
            id: "sent",
            header: t("marketing.sent"),
            cell: (c) => (c.sent_at ? String(c.sent_at).slice(0, 16) : "—"),
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
                      onClick: () => void openDetail(c),
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

      {detail ? (
        <SurfaceCard className="space-y-3 p-4">
          <div className="flex justify-between gap-2">
            <div>
              <h3 className="font-semibold text-heading">{detail.name}</h3>
              <p className="text-sm text-body">
                {detail.title} ·{" "}
                {detail.status === "Draft"
                  ? t("marketing.statusDraft")
                  : t("marketing.statusSent")}
              </p>
              {detail.delivery ? (
                <p className="text-sm text-body">
                  {t("marketing.deliverySummary", {
                    notified: detail.delivery.notified,
                    email: detail.delivery.email_only,
                    skipped: detail.delivery.skipped,
                  })}
                </p>
              ) : null}
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
          <Button type="submit" form="campaign-form" loading={busy}>
            {t("marketing.saveDraft")}
          </Button>
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
          <Field label={t("marketing.audience")}>
            <select
              className={fieldClass}
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="all">{t("marketing.audienceAll")}</option>
              <option value="khata">{t("marketing.audienceKhata")}</option>
              <option value="min_points">{t("marketing.audienceMinPoints")}</option>
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
        </form>
      </Modal>
    </div>
  );
}
