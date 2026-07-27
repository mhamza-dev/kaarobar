"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

type Campaign = {
  id: string;
  name: string;
  title: string;
  message: string;
  audience: string;
  channel?: string;
  status: string;
  sent_at?: string | null;
  recipients?: {
    id: string;
    customer_name?: string;
    channel_status: string;
    delivered_at?: string | null;
  }[];
  delivery?: {
    notified: number;
    email_only: number;
    skipped: number;
    total: number;
  };
};

function isPaidChannel(channel?: string | null) {
  return channel === "sms" || channel === "whatsapp";
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Campaign }>(`/crm/campaigns/${id}`);
      setCampaign(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendCampaign() {
    if (!campaign) return;
    if (!confirm(t("marketing.sendConfirm", { name: campaign.name }))) return;
    setBusy(true);
    try {
      const res = await api<{ data: Campaign }>(`/crm/campaigns/${campaign.id}/send`, {
        method: "POST",
        body: "{}",
      });
      setCampaign(res.data);
      toast.success(t("marketing.sentOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function payAndSend() {
    if (!campaign) return;
    if (!confirm(t("marketing.payAndSendConfirm", { name: campaign.name }))) return;
    setBusy(true);
    try {
      const res = await api<{
        data: {
          checkout_url: string;
          payment_id: string;
          dev_fallback?: boolean;
        };
      }>(`/crm/campaigns/${campaign.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({ redirect_url: window.location.href }),
      });
      if (res.data.dev_fallback) {
        const sent = await api<{ data: Campaign }>(
          `/crm/campaigns/${campaign.id}/confirm-payment`,
          {
            method: "POST",
            body: JSON.stringify({ payment_id: res.data.payment_id }),
          }
        );
        setCampaign(sent.data);
        toast.success(t("marketing.payAndSendDone"));
      } else if (res.data.checkout_url) {
        window.open(res.data.checkout_url, "_blank", "noopener,noreferrer");
        toast.success(t("marketing.checkoutOpened"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DetailShell
      backHref={routes.marketing}
      backLabel={t("marketing.backToMarketing")}
      eyebrow={t("marketing.eyebrow")}
      title={campaign?.name || t("marketing.campaignFallback")}
      subtitle={campaign?.title}
      status={
        campaign
          ? {
              label: campaign.status,
              tone: campaign.status === "Sent" ? "success" : "info",
            }
          : undefined
      }
      actions={
        campaign?.status === "Draft" ? (
          <Button
            size="sm"
            loading={busy}
            onClick={() =>
              void (isPaidChannel(campaign.channel) ? payAndSend() : sendCampaign())
            }
          >
            {isPaidChannel(campaign.channel)
              ? t("marketing.payAndSend")
              : t("marketing.send")}
          </Button>
        ) : undefined
      }
      loading={loading}
      error={error}
    >
      {campaign ? (
        <>
          <DetailSection title={t("marketing.overview")}>
            <DetailFieldGrid
              fields={[
                { label: t("marketing.channel"), value: campaign.channel || "email" },
                { label: t("marketing.audience"), value: campaign.audience },
                {
                  label: t("marketing.sentAt"),
                  value: campaign.sent_at ? String(campaign.sent_at).slice(0, 16) : "—",
                },
                {
                  label: t("marketing.recipients"),
                  value: String(campaign.recipients?.length ?? campaign.delivery?.total ?? 0),
                },
              ]}
            />
            <p className="mt-4 whitespace-pre-wrap rounded-md bg-bg-tertiary px-3 py-3 text-sm text-heading">
              {campaign.message}
            </p>
          </DetailSection>

          <DetailSection title={t("marketing.delivery")}>
            <ul className="divide-y divide-border text-sm">
              {(campaign.recipients || []).map((r) => (
                <li key={r.id} className="flex justify-between gap-2 py-2">
                  <span className="font-medium text-heading">
                    {r.customer_name || r.id.slice(0, 8)}
                  </span>
                  <span className="text-body">{r.channel_status}</span>
                </li>
              ))}
            </ul>
            {(campaign.recipients || []).length === 0 ? (
              <p className="text-sm text-body">{t("marketing.noRecipients")}</p>
            ) : null}
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
