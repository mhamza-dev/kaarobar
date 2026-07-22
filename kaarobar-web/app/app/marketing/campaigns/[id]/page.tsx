"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";

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

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Campaign }>(`/crm/campaigns/${id}`);
      setCampaign(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DetailShell
      backHref={routes.marketing}
      backLabel="Back to marketing"
      eyebrow="Campaign"
      title={campaign?.name || "Campaign"}
      subtitle={campaign?.title}
      status={
        campaign
          ? {
              label: campaign.status,
              tone: campaign.status === "Sent" ? "success" : "info",
            }
          : undefined
      }
      loading={loading}
      error={error}
    >
      {campaign ? (
        <>
          <DetailSection title="Overview">
            <DetailFieldGrid
              fields={[
                { label: "Channel", value: campaign.channel || "email" },
                { label: "Audience", value: campaign.audience },
                {
                  label: "Sent at",
                  value: campaign.sent_at ? String(campaign.sent_at).slice(0, 16) : "—",
                },
                {
                  label: "Recipients",
                  value: String(campaign.recipients?.length ?? campaign.delivery?.total ?? 0),
                },
              ]}
            />
            <p className="mt-4 whitespace-pre-wrap rounded-md bg-bg-tertiary px-3 py-3 text-sm text-heading">
              {campaign.message}
            </p>
          </DetailSection>

          <DetailSection title="Delivery">
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
              <p className="text-sm text-body">No recipients recorded yet.</p>
            ) : null}
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
